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

Usage: gdrive_backup.py <path-to-archive>
"""
import json
import os
import sys
from datetime import datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials as UserCredentials
from google.oauth2.service_account import Credentials as ServiceAccountCredentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive"]
NAME_PREFIX = "sahara-os-"


def drive_service():
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
    archive = sys.argv[1]
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
