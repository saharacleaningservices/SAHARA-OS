#!/usr/bin/env bash
# One-command recovery of Sahara OS data from a daily backup archive (the sahara-os-*.tar.gz that the GitHub backup workflow uploads to
# Google Drive, or that Settings -> System Recovery Backup downloads). Use it on a NEW or damaged server, with the app STOPPED.
#
#   bash scripts/recover-from-backup.sh <backup.tar.gz> [data-dir]
#
# data-dir defaults to the directory of DATABASE_URL (file:/data/dev.db -> /data), else ./data. The archive holds dev.db (a consistent
# VACUUM INTO snapshot, MyBillBook invoices and the parties ledger included) and public/uploads. Afterwards start the app normally; boot
# runs scripts/db-setup.mjs, which migrates the schema and switches the database back to WAL mode.
set -euo pipefail

archive="${1:-}"
if [ -z "$archive" ] || [ ! -f "$archive" ]; then
  echo "usage: bash scripts/recover-from-backup.sh <backup.tar.gz> [data-dir]" >&2
  exit 2
fi
if [[ "$archive" == *.enc || "$archive" == *.gpg ]]; then
  echo "This looks like an encrypted copy. Decrypt it first (BACKUP_RESTORE_GUIDE.md), then pass the .tar.gz." >&2
  exit 2
fi

if [ -n "${2:-}" ]; then
  data="$2"
elif [ -n "${DATABASE_URL:-}" ]; then
  data="$(dirname "${DATABASE_URL#file:}")"
else
  data="./data"
fi
mkdir -p "$data"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
tar --force-local -xzf "$archive" -C "$work"
[ -f "$work/dev.db" ] || { echo "Archive has no dev.db - not a Sahara OS backup." >&2; exit 1; }

# Verify BEFORE touching anything live.
node - "$work/dev.db" <<'JS'
const D = require("better-sqlite3");
const d = new D(process.argv[2], { readonly: true });
const ok = d.pragma("integrity_check", { simple: true });
const users = d.prepare("SELECT COUNT(*) AS c FROM User").get().c;
const count = (t) => {
  const has = d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  return has ? d.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c : 0;
};
console.log("integrity:", ok, "| users:", users, "| customers:", count("Customer"), "| jobs:", count("Job"), "| MyBillBook invoices:", count("MybillbookInvoice"));
if (ok !== "ok" || users < 1) process.exit(1);
JS

stamp="$(date +%Y%m%d-%H%M%S)"
if [ -f "$data/dev.db" ]; then
  cp "$data/dev.db" "$data/dev.db.before-recover-$stamp"
  echo "Existing database kept as $data/dev.db.before-recover-$stamp"
fi
cp "$work/dev.db" "$data/dev.db"
rm -f "$data/dev.db-wal" "$data/dev.db-shm"   # stale WAL files belong to the old database

if [ -d "$work/uploads" ]; then
  mkdir -p "$data/uploads"
  cp -a "$work/uploads/." "$data/uploads/"
  echo "Uploads restored to $data/uploads (point /app/public/uploads at this folder or copy it there)."
fi

DATABASE_URL="file:$data/dev.db" node scripts/db-setup.mjs
echo "Recovered. Start the app (docker/Coolify redeploy) and check /api/health."
