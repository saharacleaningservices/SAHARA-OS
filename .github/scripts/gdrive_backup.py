#!/usr/bin/env python3
"""Upload one backup archive to Google Drive and apply tiered retention.

Called by .github/workflows/backup.yml, after verify_backup.py has already
confirmed the archive is a valid, intact database.

Retention (day-based since 2026-10-14 — repeated manual runs can no longer push real history out):
  - Everything from the last KEEP_RECENT_HOURS (default 48) is kept, so a manual run or a re-run is never lost
    right away.
  - Before that, the newest archive of each calendar day (IST) is kept for KEEP_DAILY days (default 30).
  - Before that, the newest archive of each calendar month is kept for KEEP_MONTHLY months (default 12).
  - The newest archive overall is always kept, and one run never deletes more than MAX_DELETE_PER_RUN files
    (default 40): if the plan would delete more, nothing is deleted and the run says so (a bug can never wipe
    the history).

Env:
  GDRIVE_CREDENTIALS  JSON. Either a service-account key, or an OAuth user
                      credential: {"client_id","client_secret","refresh_token"}.
  GDRIVE_FOLDER_ID    Target Drive folder id ("Sahara OS Backups").
  KEEP_DAILY          How many DAYS of one-archive-per-day history to keep (default 30).
  KEEP_MONTHLY        How many calendar months to keep one archive from, beyond the daily window (default 12).
  KEEP_RECENT_HOURS   Keep every archive newer than this many hours (default 48).
  MAX_DELETE_PER_RUN  Safety cap on deletions per run (default 40).

Delivery guarantees (2026-10-14): a missing/invalid credential or folder id is a HARD FAILURE (never a silent
skip), and after the upload the file is re-read from Drive and its size must equal the local archive's size,
otherwise the run fails. A green run therefore means "the archive is in Drive".

Usage: gdrive_backup.py <path-to-archive>
       gdrive_backup.py --check-config        (validates the env only; no network, no secrets printed)
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

# Google client libraries are imported lazily (inside the functions that need them) so the config check and the
# unit tests run without them installed.

SCOPES = ["https://www.googleapis.com/auth/drive"]
NAME_PREFIX = "sahara-os-"


class BackupDeliveryError(Exception):
    """The archive did not provably reach Google Drive. Always fails the workflow."""


def require_config(env=None):
    """Raise BackupDeliveryError unless Drive delivery is fully configured. Never echoes any value."""
    env = os.environ if env is None else env
    for name in ("GDRIVE_CREDENTIALS", "GDRIVE_FOLDER_ID"):
        if not str(env.get(name, "")).strip():
            raise BackupDeliveryError(f"{name} is not configured - the backup cannot be delivered to Google Drive")
    try:
        info = json.loads(env["GDRIVE_CREDENTIALS"])
    except ValueError:
        raise BackupDeliveryError("GDRIVE_CREDENTIALS is not valid JSON") from None
    if not isinstance(info, dict):
        raise BackupDeliveryError("GDRIVE_CREDENTIALS must be a JSON object")
    if info.get("type") != "service_account":
        missing = [k for k in ("client_id", "client_secret", "refresh_token") if not info.get(k)]
        if missing:
            raise BackupDeliveryError("GDRIVE_CREDENTIALS is missing required field(s): " + ", ".join(missing))
    return info


def verify_upload(created, local_size):
    """The file Drive reports back must exist and have exactly the local archive's size."""
    if not created or not created.get("id"):
        raise BackupDeliveryError("Drive did not return a file id for the upload")
    try:
        remote = int(created.get("size"))
    except (TypeError, ValueError):
        raise BackupDeliveryError("Drive did not report the uploaded file size") from None
    if remote != local_size:
        raise BackupDeliveryError(f"Uploaded size {remote} B does not match local archive {local_size} B")
    return remote


def drive_service():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials as UserCredentials
    from google.oauth2.service_account import Credentials as ServiceAccountCredentials
    from googleapiclient.discovery import build

    info = json.loads(os.environ["GDRIVE_CREDENTIALS"])
    if info.get("type") == "service_account":
        creds = ServiceAccountCredentials.from_service_account_info(info, scopes=SCOPES)
    else:
        creds = UserCredentials(
            token=None,
            refresh_token=info["refresh_token"],
            client_id=info["client_id"],
            client_secret=info["client_secret"],
            token_uri=info.get("token_uri", "https://oauth2.googleapis.com/token"),
            scopes=SCOPES,
        )
        creds.refresh(Request())
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def same_kind(name: str, archive: str) -> bool:
    """Retention must only ever prune files of the SAME kind as the one just uploaded: the Sunday encrypted copy
    (.enc, KEEP_DAILY=12) must never delete plaintext dailies, and vice versa."""
    return name.endswith(".enc") == archive.endswith(".enc")


IST = timezone(timedelta(hours=5, minutes=30))


def _created(f):
    return datetime.fromisoformat(f["createdTime"].replace("Z", "+00:00")).astimezone(IST)


def select_retained(items, now, keep_days=30, keep_months=12, keep_recent_hours=48):
    """Return the ids to KEEP. `items` are dicts with id + createdTime (ISO, UTC). Pure function (unit tested)."""
    if not items:
        return set()
    ordered = sorted(items, key=_created, reverse=True)
    keep = {ordered[0]["id"]}  # the newest archive is never deleted
    now_ist = now.astimezone(IST)
    recent_cut = now_ist - timedelta(hours=keep_recent_hours)
    day_cut = (now_ist - timedelta(days=keep_days)).date()
    seen_days, seen_months = set(), []
    for f in ordered:  # newest first
        c = _created(f)
        if c >= recent_cut:
            keep.add(f["id"])
        day = c.date()
        if day > day_cut or day == day_cut:
            if day not in seen_days:
                seen_days.add(day)
                keep.add(f["id"])
            continue
        month = (c.year, c.month)
        if month not in seen_months and len(seen_months) < keep_months:
            seen_months.append(month)
            keep.add(f["id"])
    return keep


def plan_deletions(items, kept_ids, max_delete):
    """Files to delete: everything not kept - unless that is more than max_delete, then NOTHING (safety cap)."""
    stale = [f for f in items if f["id"] not in kept_ids]
    return [] if len(stale) > max_delete else stale


def month_key(created_time: str) -> str:
    # createdTime looks like "2026-09-04T20:30:12.345Z"
    dt = datetime.fromisoformat(created_time.replace("Z", "+00:00"))
    return f"{dt.year:04d}-{dt.month:02d}"


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "--check-config":
        try:
            require_config()
        except BackupDeliveryError as e:
            print(f"::error::{e}")
            return 1
        print("Google Drive delivery is configured (values not shown).")
        return 0
    archive = sys.argv[1]
    try:
        require_config()
    except BackupDeliveryError as e:
        print(f"::error::{e}")
        return 1
    from googleapiclient.http import MediaFileUpload

    folder_id = os.environ["GDRIVE_FOLDER_ID"]
    keep_daily = int(os.environ.get("KEEP_DAILY", os.environ.get("KEEP_BACKUPS", "30")))
    keep_monthly = int(os.environ.get("KEEP_MONTHLY", "12"))
    keep_recent_hours = int(os.environ.get("KEEP_RECENT_HOURS", "48"))
    max_delete = int(os.environ.get("MAX_DELETE_PER_RUN", "40"))
    svc = drive_service()

    name = os.path.basename(archive)
    media = MediaFileUpload(archive, mimetype="application/gzip", resumable=True)
    created = svc.files().create(
        body={"name": name, "parents": [folder_id]},
        media_body=media,
        fields="id, name, size",
        supportsAllDrives=True,
    ).execute()
    try:
        verify_upload(created, os.path.getsize(archive))
    except BackupDeliveryError as e:
        print(f"::error::{e}")
        return 1
    print(f"Uploaded and size-verified {created['name']} ({created.get('size', '?')} bytes, id={created['id']})")

    query = (
        f"'{folder_id}' in parents and trashed = false "
        f"and name contains '{NAME_PREFIX}'"
    )
    items = []
    page_token = None
    while True:
        resp = svc.files().list(
            q=query,
            orderBy="createdTime desc",
            pageSize=1000,
            fields="nextPageToken, files(id, name, createdTime)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        items.extend(f for f in resp.get("files", []) if same_kind(f["name"], archive))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    kept_ids = select_retained(
        items, datetime.now(timezone.utc), keep_days=keep_daily, keep_months=keep_monthly, keep_recent_hours=keep_recent_hours
    )
    kept_ids.add(created["id"])  # the archive we just uploaded is never a deletion candidate
    stale = plan_deletions(items, kept_ids, max_delete)
    if not stale and len([f for f in items if f["id"] not in kept_ids]) > max_delete:
        print(f"::warning::Retention would delete more than {max_delete} files; deleting nothing this run. Review manually.")

    for f in stale:
        svc.files().delete(fileId=f["id"], supportsAllDrives=True).execute()
        print(f"Deleted old backup {f['name']}")

    print(f"Done. {len(kept_ids)} backup(s) retained, {len(stale)} removed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
