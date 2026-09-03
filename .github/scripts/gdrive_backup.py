#!/usr/bin/env python3
"""Upload one backup archive to Google Drive and keep only the newest N.

Called by .github/workflows/backup.yml.

Env:
  GDRIVE_CREDENTIALS  JSON. Either a service-account key, or an OAuth user
                      credential: {"client_id","client_secret","refresh_token"}.
  GDRIVE_FOLDER_ID    Target Drive folder id ("Sahara OS Backups").
  KEEP_BACKUPS        How many archives to retain (default 30).

Usage: gdrive_backup.py <path-to-archive>
"""
import json
import os
import sys

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


def main() -> int:
    archive = sys.argv[1]
    folder_id = os.environ["GDRIVE_FOLDER_ID"]
    keep = int(os.environ.get("KEEP_BACKUPS", "30"))
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
            pageSize=200,
            fields="nextPageToken, files(id, name, createdTime)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        items.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    stale = items[keep:]
    for f in stale:
        svc.files().delete(fileId=f["id"], supportsAllDrives=True).execute()
        print(f"Deleted old backup {f['name']}")

    print(f"Done. {min(len(items), keep)} backup(s) retained, {len(stale)} removed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
