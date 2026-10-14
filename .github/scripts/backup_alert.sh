#!/usr/bin/env bash
# Opens (or updates) ONE GitHub Issue when the backup workflow fails, and closes it again after the next good run.
# Uses only the workflow's built-in GITHUB_TOKEN via the gh CLI (GH_TOKEN) - no extra credentials, nothing secret is printed.
# GitHub e-mails everyone watching the repo about a new issue, which is the e-mail alert.
#
# Usage: backup_alert.sh failure|success      Env: GH_TOKEN, GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_RUN_ID
set -uo pipefail
mode="${1:-}"
repo="${GITHUB_REPOSITORY:?}"
run_url="${GITHUB_SERVER_URL:-https://github.com}/${repo}/actions/runs/${GITHUB_RUN_ID:-0}"
label="backup-failure"
today="$(TZ=Asia/Kolkata date +%F)"

open_issue() { gh issue list --repo "$repo" --label "$label" --state open --json number --jq '.[0].number // empty' 2>/dev/null; }

case "$mode" in
  failure)
    existing="$(open_issue)"
    if [ -n "$existing" ]; then
      gh issue comment "$existing" --repo "$repo" --body "Backup failed again on ${today} (IST). Run: ${run_url}" \
        || echo "::warning::could not comment on backup-failure issue #${existing}"
    else
      gh label create "$label" --repo "$repo" --color B60205 --description "Sahara OS backup did not reach Google Drive" >/dev/null 2>&1 || true
      gh issue create --repo "$repo" --label "$label" \
        --title "Backup FAILED - ${today}" \
        --body "The Sahara OS backup did **not** reach Google Drive.

Run: ${run_url}

Check the failed step (download, integrity check, Drive configuration or upload). The last good backup is still in Drive > Sahara OS Backups. Restore steps: docs/DISASTER_RECOVERY_RUNBOOK.md. This issue closes itself after the next successful backup." \
        || echo "::warning::could not open the backup-failure issue (are GitHub Issues enabled?)"
    fi
    ;;
  success)
    for n in $(gh issue list --repo "$repo" --label "$label" --state open --json number --jq '.[].number' 2>/dev/null); do
      gh issue close "$n" --repo "$repo" --comment "Backup succeeded on ${today} (IST) - delivered and size-verified in Google Drive. ${run_url}" || true
    done
    ;;
  *) echo "usage: backup_alert.sh failure|success" >&2; exit 2 ;;
esac
