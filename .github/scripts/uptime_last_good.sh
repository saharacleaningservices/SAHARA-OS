#!/usr/bin/env bash
# Prints a short note for the uptime alerts: when the monitor last saw every site up, and when it last ran at all.
# GitHub runs scheduled workflows far less often than every 5 minutes (sometimes hours apart), so the gap between two
# checks says little about how long a site was really down — this note makes that gap visible in the issue.
# A past run counts as "up" when its "Open or update the outage issue" step was skipped (see uptime.yml).
# Needs: gh, GH_TOKEN, GITHUB_REPOSITORY, workflow permission `actions: read`. Never fails the workflow.
set -uo pipefail

REPO="${GITHUB_REPOSITORY:-}"
LOOKBACK="${LOOKBACK:-20}"

ist() { TZ=Asia/Kolkata date -d "$1" '+%d %b %Y %H:%M IST' 2>/dev/null || echo "$1"; }
ago() {
  local mins h m
  mins=$(( ( $(date -u +%s) - $(date -u -d "$1" +%s 2>/dev/null || date -u +%s) ) / 60 ))
  [ "$mins" -lt 0 ] && mins=0
  h=$(( mins / 60 )); m=$(( mins % 60 ))
  if [ "$h" -gt 0 ]; then echo "${h} h ${m} min"; else echo "${m} min"; fi
}

if [ -z "$REPO" ]; then
  echo "Last successful check: unknown (repository not set)."
  exit 0
fi

runs="$(gh api "repos/${REPO}/actions/workflows/uptime.yml/runs?status=completed&per_page=${LOOKBACK}" \
  --jq '.workflow_runs[] | "\(.id) \(.run_started_at)"' 2>/dev/null)" || runs=""

prev_ts=""; prev_state=""; good_ts=""
while read -r id ts; do
  [ -z "${id:-}" ] && continue
  step="$(gh api "repos/${REPO}/actions/runs/${id}/jobs" \
    --jq '[.jobs[0].steps[] | select(.name=="Open or update the outage issue") | .conclusion][0] // "unknown"' 2>/dev/null)" || step="unknown"
  case "$step" in skipped) state="up" ;; success) state="down" ;; *) state="unknown" ;; esac
  if [ -z "$prev_ts" ]; then prev_ts="$ts"; prev_state="$state"; fi
  if [ "$state" = "up" ]; then good_ts="$ts"; break; fi
done <<< "$runs"

if [ -n "$good_ts" ]; then
  echo "Last successful check: $(ist "$good_ts") ($(ago "$good_ts") ago)."
else
  echo "Last successful check: none found in the last ${LOOKBACK} runs."
fi
if [ -n "$prev_ts" ] && [ "$prev_ts" != "$good_ts" ]; then
  echo "Previous check before this one: $(ist "$prev_ts") (${prev_state})."
fi
echo "Note: GitHub can run this monitor hours apart, so the real downtime may be much shorter than the time between two checks."
exit 0
