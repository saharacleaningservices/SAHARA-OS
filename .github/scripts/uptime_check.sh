#!/usr/bin/env bash
# Sahara OS uptime check. Prints one line per URL and a final DOWN list; exit 1 if anything is down.
# A URL is "up" when it answers with one of its expected HTTP codes within the timeout.
# Every failure is retried once after RETRY_DELAY seconds, so a single slow request never raises an alert.
set -uo pipefail

TIMEOUT="${TIMEOUT:-20}"
RETRY_DELAY="${RETRY_DELAY:-30}"

# url|expected codes (space separated)
CHECKS=(
  "https://crm.saharacleaningservices.com/login|200"
  "https://crm.saharacleaningservices.com/my|200 307"
  "https://booking.saharacleaningservices.com/booking|200"
)
[ -n "${UPTIME_CHECKS:-}" ] && IFS=';' read -r -a CHECKS <<< "$UPTIME_CHECKS"

probe() { curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time "$TIMEOUT" "$1" 2>/dev/null || true; }

down=()
for entry in "${CHECKS[@]}"; do
  url="${entry%%|*}"; expected="${entry#*|}"
  read -r code secs <<< "$(probe "$url")"
  if ! grep -qw -- "${code:-000}" <<< "$expected"; then
    sleep "$RETRY_DELAY"
    read -r code secs <<< "$(probe "$url")"
  fi
  if grep -qw -- "${code:-000}" <<< "$expected"; then
    echo "UP   $url -> ${code} in ${secs}s"
  else
    echo "DOWN $url -> ${code:-000} (expected: $expected)"
    down+=("$url (HTTP ${code:-000})")
  fi
done

if [ "${#down[@]}" -gt 0 ]; then
  printf 'DOWN_LIST=%s\n' "$(IFS=', '; echo "${down[*]}")"
  exit 1
fi
echo "ALL_UP"
