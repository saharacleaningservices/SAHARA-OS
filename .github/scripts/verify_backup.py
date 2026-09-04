#!/usr/bin/env python3
"""Verify a Sahara OS backup archive before it's trusted/uploaded.

Extracts dev.db from the .tar.gz and checks it with SQLite's own integrity
check plus a sanity check that the User table has at least one row — using
only the Python standard library (sqlite3, tarfile), so this needs no extra
dependencies beyond what the workflow already installs.

Exits non-zero (failing the workflow loudly) if anything looks wrong, so a
corrupt or empty backup is never uploaded or counted as a valid retention
point.

Usage: verify_backup.py <path-to-archive>
"""
import sqlite3
import sys
import tarfile
import tempfile
from pathlib import Path


def main() -> int:
    archive = Path(sys.argv[1])
    if not archive.exists():
        print(f"::error::backup archive not found: {archive}")
        return 1

    with tempfile.TemporaryDirectory() as workdir:
        with tarfile.open(archive, "r:gz") as tar:
            tar.extractall(workdir, filter="data")

        db_path = Path(workdir) / "dev.db"
        if not db_path.exists():
            print("::error::archive does not contain dev.db")
            return 1

        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        try:
            integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
            if integrity != "ok":
                print(f"::error::integrity check failed: {integrity}")
                return 1

            user_count = conn.execute('SELECT COUNT(*) FROM "User"').fetchone()[0]
            if user_count < 1:
                print("::error::backup has zero users — refusing to trust it")
                return 1
        finally:
            conn.close()

        size_bytes = archive.stat().st_size
        print(f"Backup verified OK — integrity_check=ok, {user_count} user(s), {size_bytes:,} bytes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
