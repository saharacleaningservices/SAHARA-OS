#!/usr/bin/env bash
# Post-deploy verification for Batch 1 (and, with BATCH=2, Batch 2).
#   bash verify_redirects_batch1.sh          # Batch 1
#   BATCH=2 bash verify_redirects_batch1.sh  # Batch 2
# Passes only if each old URL returns ONE permanent redirect (301/308) to the exact new URL,
# the new URL returns 200 with a self-canonical and no noindex, and the sitemap is updated.
# Read-only: it only sends GET/HEAD requests.
BASE="https://saharacleaningservices.com"
BATCH="${BATCH:-1}"
CSV="$(dirname "$0")/redirects_301.csv"
fail=0
SITEMAP="$(curl -s -m 30 "$BASE/sitemap.xml")"
while IFS=, read -r from to status batch; do
  [ "$batch" = "$BATCH" ] || continue
  # 1) old URL: permanent status, Location equals the new URL (absolute or relative)
  out="$(curl -s -m 20 -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE$from")"
  code="${out%% *}"; loc="${out#* }"
  if [[ ( "$code" == "301" || "$code" == "308" ) && ( "$loc" == "$BASE$to" || "$loc" == "$to" ) ]]; then r1=OK; else r1="FAIL($code $loc)"; fail=1; fi
  # 2) one hop only: following redirects ends at the new URL after exactly 1 redirect
  hop="$(curl -sIL -m 20 -o /dev/null -w '%{num_redirects} %{http_code} %{url_effective}' "$BASE$from")"
  if [ "$hop" = "1 200 $BASE$to" ]; then r2=OK; else r2="FAIL($hop)"; fail=1; fi
  # 3) new URL: 200, canonical = itself, no noindex
  html="$(curl -s -m 20 "$BASE$to")"
  canon="$(echo "$html" | grep -oiE '<link rel="canonical" href="[^"]*"' | head -1 | sed -E 's/.*href="([^"]*)"/\1/')"
  if [ "$canon" = "$BASE$to" ]; then r3=OK; else r3="FAIL(canonical=$canon)"; fail=1; fi
  if echo "$html" | grep -qiE '<meta name="robots" content="[^"]*noindex'; then r4="FAIL(noindex)"; fail=1; else r4=OK; fi
  # 4) sitemap: new URL present, old URL absent
  if echo "$SITEMAP" | grep -q "<loc>$BASE$to</loc>" && ! echo "$SITEMAP" | grep -q "<loc>$BASE$from</loc>"; then r5=OK; else r5="FAIL"; fail=1; fi
  # 5) common variants reach the new URL in a single hop
  for v in "http://saharacleaningservices.com$from" "https://www.saharacleaningservices.com$from"; do
    vh="$(curl -sIL -m 20 -o /dev/null -w '%{num_redirects} %{url_effective}' "$v")"
    [ "${vh#* }" = "$BASE$to" ] || { r6="FAIL($v -> $vh)"; fail=1; }
    n="${vh%% *}"; [ "$n" -le 2 ] 2>/dev/null || { r6="WARN($v took $n hops)"; }
  done
  printf '%-22s redirect:%s onehop:%s canonical:%s noindex:%s sitemap:%s variants:%s\n' "$from" "$r1" "$r2" "$r3" "$r4" "$r5" "${r6:-OK}"
  unset r6
done < <(tail -n +2 "$CSV")
[ "$fail" = 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $fail
