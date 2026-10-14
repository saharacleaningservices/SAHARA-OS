#!/usr/bin/env python3
"""Upload one backup archive to Google Drive and apply tiered retention.

Called by .github/workflows/backup.yml, after verify_backup.py has already
confirmed the archive is a valid, intact database.

Retention (enterprise tiering):
  - The newest KEEP_DAILY archives (default 30) are always kept — the daily
    tier, for quick recent-history recovery.
  - Beyond that, the newest archive in each of the last KEEP_MONTHLY
    distinct calendar months (default 12) is kept as that month's
    "monthly" snapshot, even though it's older than the daily window.
  - Everything else is deleted.

Env:
  GDRIVE_CREDENTIALS  JSON. Either a service-account key, or an OAuth user
                      credential: {"client_id","client_secret","refresh_token"}.
  GDRIVE_FOLDER_ID    Target Drive folder id ("Sahara OS Backups").
  KEEP_DAILY          How many most-recent archives to always keep (default 30).
  KEEP_MONTHLY        How many distinct calendar months to keep one archive
                      from, beyond the daily window (default 12).

Delivery guarantees (2026-10-14): a missing/invalid credential or folder id is a HARD FAILURE (never a silent
skip), and after the upload the file is re-read from Drive and its size must equal the local archive's size,
otherwise the run fails. A green run therefore means "the archive is in Drive".

Usage: gdrive_backup.py <path-to-archive>
       gdrive_backup.py --check-config        (validates the env only; no network, no secrets printed)
"""
import json
import os
import sys
from datetime import datetime

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

    # Tier 1 — daily: the newest `keep_daily` archives, unconditionally kept.
    daily_kept = items[:keep_daily]
    remainder = items[keep_daily:]

    # Tier 2 — monthly: from what's left (older than the daily window), keep
    # the single newest archive for each of the last `keep_monthly` distinct
    # calendar months.
    monthly_kept = []
    seen_months = set()
    for f in remainder:
        key = month_key(f["createdTime"])
        if key in seen_months:
            continue
        if len(seen_months) >= keep_monthly:
            break
        seen_months.add(key)
        monthly_kept.append(f)

    kept_ids = {f["id"] for f in daily_kept} | {f["id"] for f in monthly_kept}
    stale = [f for f in items if f["id"] not in kept_ids]

    for f in stale:
        svc.files().delete(fileId=f["id"], supportsAllDrives=True).execute()
        print(f"Deleted old backup {f['name']}")

    print(
        f"Done. {len(daily_kept)} daily + {len(monthly_kept)} monthly backup(s) retained "
        f"({len(kept_ids)} total), {len(stale)} removed."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
