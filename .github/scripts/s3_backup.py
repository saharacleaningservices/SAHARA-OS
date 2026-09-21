#!/usr/bin/env python3
"""Upload one backup archive to an S3-compatible bucket and apply tiered
retention — the primary off-site destination (owner instruction 2026-09-21:
"Do not use Google Drive as primary backup"; Google Drive upload in this
same workflow is now optional/secondary, gated on its own credentials).

Works with any S3-compatible endpoint via S3_ENDPOINT_URL — AWS S3,
Hostinger Object Storage, Backblaze B2, Wasabi, Cloudflare R2, MinIO, etc.
— since they all speak the same S3 API that boto3 targets.

Retention (same tiering as gdrive_backup.py, kept identical on purpose so
both destinations behave predictably):
  - The newest KEEP_DAILY objects under the given prefix (default 30) are
    always kept.
  - Beyond that, the newest object in each of the last KEEP_MONTHLY
    distinct calendar months (default 12) is kept.
  - Everything else is deleted.

Env:
  S3_ENDPOINT_URL   Full endpoint URL, e.g. https://<region>.hostinger.com
                    or https://s3.<region>.amazonaws.com (omit for AWS's
                    default global endpoint resolution).
  S3_BUCKET         Target bucket name.
  S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
  S3_REGION         Optional, default "auto" (works for R2/most S3-compatible
                     providers; set a real AWS region if using AWS S3).
  S3_PREFIX         Optional key prefix, default "sahara-os-backups/".
  KEEP_DAILY / KEEP_MONTHLY  Same meaning as gdrive_backup.py.

Usage: s3_backup.py <path-to-archive>
"""
import os
import sys

import boto3
from botocore.client import Config

NAME_PREFIX = "sahara-os-"


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT_URL") or None,
        aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
        region_name=os.environ.get("S3_REGION", "auto"),
        config=Config(signature_version="s3v4"),
    )


def month_key(last_modified) -> str:
    return f"{last_modified.year:04d}-{last_modified.month:02d}"


def main() -> int:
    archive = sys.argv[1]
    bucket = os.environ["S3_BUCKET"]
    prefix = os.environ.get("S3_PREFIX", "sahara-os-backups/")
    keep_daily = int(os.environ.get("KEEP_DAILY", "30"))
    keep_monthly = int(os.environ.get("KEEP_MONTHLY", "12"))
    svc = s3_client()

    name = os.path.basename(archive)
    key = f"{prefix}{name}"
    svc.upload_file(archive, bucket, key)
    size = os.path.getsize(archive)
    print(f"Uploaded s3://{bucket}/{key} ({size} bytes)")

    # List every object under the prefix, newest first.
    items = []
    paginator = svc.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            if NAME_PREFIX in obj["Key"]:
                items.append(obj)
    items.sort(key=lambda o: o["LastModified"], reverse=True)

    # Tier 1 — daily: newest `keep_daily`, unconditionally kept.
    daily_kept = items[:keep_daily]
    remainder = items[keep_daily:]

    # Tier 2 — monthly: from what's left, keep the newest object per distinct
    # calendar month, for the last `keep_monthly` distinct months.
    monthly_kept = []
    seen_months = set()
    for obj in remainder:
        mk = month_key(obj["LastModified"])
        if mk in seen_months:
            continue
        if len(seen_months) >= keep_monthly:
            break
        seen_months.add(mk)
        monthly_kept.append(obj)

    kept_keys = {o["Key"] for o in daily_kept} | {o["Key"] for o in monthly_kept}
    stale = [o for o in items if o["Key"] not in kept_keys]

    for obj in stale:
        svc.delete_object(Bucket=bucket, Key=obj["Key"])
        print(f"Deleted old backup {obj['Key']}")

    print(
        f"Done. {len(daily_kept)} daily + {len(monthly_kept)} monthly backup(s) retained "
        f"({len(kept_keys)} total), {len(stale)} removed."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
