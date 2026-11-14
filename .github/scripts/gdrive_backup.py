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

Destination (owner 2026-11-14): a Drive folder named "Sahara OS Backups"
owned by shaikhaltaf161@gmail.com. Both are configurable; see BACKUP.md.

Env:
  GDRIVE_CREDENTIALS         JSON. Either an OAuth user credential minted as
                             the folder owner {"client_id","client_secret",
                             "refresh_token"} (recommended for a personal
                             @gmail.com owner), or a service-account key
                             (works only when the folder is in a Shared
                             Drive — service accounts have no My Drive quota).
  GDRIVE_BACKUP_FOLDER_NAME  Folder name to upload into
                             (default "Sahara OS Backups").
  GDRIVE_BACKUP_OWNER_EMAIL  Google account that must own the folder
                             (default shaikhaltaf161@gmail.com). Set to "-"
                             to skip the owner check (e.g. a Shared Drive).
  GDRIVE_FOLDER_ID           Optional. Pin the exact folder id; it is still
                             checked against the name + owner above. Without
                             it the folder is looked up by name + owner.
  GDRIVE_STRICT_FOLDER       "1" = fail when the pinned folder's name/owner
                             do not match; "0" (default) = warn and still
                             upload, so a not-yet-migrated pinned folder never
                             costs a night's backup. Set "1" once migrated.
  KEEP_DAILY          How many most-recent archives to always keep (default 30).
  KEEP_MONTHLY        How many distinct calendar months to keep one archive
                      from, beyond the daily window (default 12).

Usage: gdrive_backup.py <path-to-archive>
"""
import json
import os
import sys
from datetime import datetime

SCOPES = ["https://www.googleapis.com/auth/drive"]
NAME_PREFIX = "sahara-os-"
FOLDER_MIME = "application/vnd.google-apps.folder"
DEFAULT_FOLDER_NAME = "Sahara OS Backups"
DEFAULT_OWNER_EMAIL = "shaikhaltaf161@gmail.com"


def destination_config(env=os.environ):
    """Folder name / owner / optional pinned id from the environment, with the owner's defaults.

    Empty values (an unset GitHub repo variable renders as "") fall back to the defaults, except an explicit
    GDRIVE_BACKUP_OWNER_EMAIL="-" which disables the owner check.
    """
    name = (env.get("GDRIVE_BACKUP_FOLDER_NAME") or "").strip() or DEFAULT_FOLDER_NAME
    owner = (env.get("GDRIVE_BACKUP_OWNER_EMAIL") or "").strip() or DEFAULT_OWNER_EMAIL
    if owner == "-":
        owner = ""
    return {
        "name": name,
        "owner": owner.lower(),
        "folder_id": (env.get("GDRIVE_FOLDER_ID") or "").strip() or None,
        "strict": (env.get("GDRIVE_STRICT_FOLDER") or "0").strip() == "1",
    }


def _q(value):
    return value.replace("\\", "\\\\").replace("'", "\\'")


def folder_query(name, owner):
    """Drive search for the backup folder: exact name, a folder, not trashed, owned by `owner` (when set)."""
    q = f"mimeType = '{FOLDER_MIME}' and name = '{_q(name)}' and trashed = false"
    if owner:
        q += f" and '{_q(owner)}' in owners"
    return q


def folder_problems(meta, name, owner):
    """Why a folder's metadata does not match the configured destination ([] = it matches)."""
    problems = []
    if meta.get("mimeType") != FOLDER_MIME:
        problems.append("is not a folder")
    if meta.get("trashed"):
        problems.append("is in the trash")
    if meta.get("name") != name:
        problems.append(f"is named {meta.get('name')!r}, expected {name!r}")
    owners = [str(o.get("emailAddress", "")).lower() for o in meta.get("owners", []) or []]
    # Shared-Drive folders have no "owners" (the drive owns them); only check My Drive folders.
    if owner and owners and owner not in owners:
        problems.append(f"is owned by {', '.join(owners)}, expected {owner}")
    return problems


def resolve_folder(svc, cfg):
    """Returns the folder id to upload into, after checking it is the owner's "Sahara OS Backups" folder."""
    fields = "id, name, mimeType, trashed, owners(emailAddress), driveId"
    if cfg["folder_id"]:
        meta = svc.files().get(fileId=cfg["folder_id"], fields=fields, supportsAllDrives=True).execute()
        problems = folder_problems(meta, cfg["name"], cfg["owner"])
        if problems:
            msg = f"GDRIVE_FOLDER_ID {cfg['folder_id']} " + "; ".join(problems)
            if cfg["strict"]:
                raise SystemExit(f"::error::{msg}. Fix the secret/variables (see BACKUP.md) or set GDRIVE_STRICT_FOLDER=0.")
            print(f"::warning::{msg}")
        return meta["id"]
    resp = svc.files().list(
        q=folder_query(cfg["name"], cfg["owner"]),
        fields="files(id, name, owners(emailAddress), createdTime)",
        orderBy="createdTime",
        pageSize=10,
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
    ).execute()
    found = resp.get("files", [])
    if not found:
        who = f" owned by {cfg['owner']}" if cfg["owner"] else ""
        raise SystemExit(
            f"::error::No Drive folder named {cfg['name']!r}{who} is visible to these credentials. "
            "Create it in that account's My Drive and either mint GDRIVE_CREDENTIALS as that account (OAuth) "
            "or share it with the uploading account as Editor — see BACKUP.md."
        )
    if len(found) > 1:
        print(f"::warning::{len(found)} folders named {cfg['name']!r} found; using the oldest ({found[0]['id']}). Pin GDRIVE_FOLDER_ID to choose.")
    return found[0]["id"]


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


def month_key(created_time: str) -> str:
    # createdTime looks like "2026-09-04T20:30:12.345Z"
    dt = datetime.fromisoformat(created_time.replace("Z", "+00:00"))
    return f"{dt.year:04d}-{dt.month:02d}"


def main() -> int:
    from googleapiclient.http import MediaFileUpload

    archive = sys.argv[1]
    cfg = destination_config()
    keep_daily = int(os.environ.get("KEEP_DAILY", os.environ.get("KEEP_BACKUPS", "30")))
    keep_monthly = int(os.environ.get("KEEP_MONTHLY", "12"))
    svc = drive_service()
    folder_id = resolve_folder(svc, cfg)
    print(f"Destination: Drive folder {cfg['name']!r}" + (f" owned by {cfg['owner']}" if cfg["owner"] else "") + f" (id={folder_id})")

    name = os.path.basename(archive)
    media = MediaFileUpload(archive, mimetype="application/gzip", resumable=True)
    created = svc.files().create(
        body={"name": name, "parents": [folder_id]},
        media_body=media,
        fields="id, name, size",
        supportsAllDrives=True,
    ).execute()
    print(f"Uploaded {created['name']} ({created.get('size', '?')} bytes, id={created['id']})")

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
        items.extend(resp.get("files", []))
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
