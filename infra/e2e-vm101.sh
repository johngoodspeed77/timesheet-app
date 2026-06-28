#!/bin/bash
set -euo pipefail
BASE="${BASE:-http://192.168.1.19}"
EMAIL="${EMAIL:-e2e-test@whitelynx.test}"
PASS="${PASS:-E2eTestPass123!}"

echo "==> Signup $EMAIL"
SIGNUP=$(curl -s -X POST "$BASE/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "$SIGNUP"

TOKEN=$(echo "$SIGNUP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')
USER_ID=$(echo "$SIGNUP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("user",{}).get("id",""))')

if [ -z "$TOKEN" ]; then
  echo "==> Signup failed, trying login"
  SIGNUP=$(curl -s -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  echo "$SIGNUP"
  TOKEN=$(echo "$SIGNUP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))')
  USER_ID=$(echo "$SIGNUP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("user",{}).get("id",""))')
fi

[ -n "$TOKEN" ] || { echo "FAIL: no access token"; exit 1; }

echo "==> Settings"
curl -s -X POST "$BASE/rest/v1/user_settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"user_id\":\"$USER_ID\",\"boss_email\":\"johngoodspeed77@gmail.com\",\"employee_name\":\"E2E Tester\"}"
echo

WEEK=$(python3 -c 'from datetime import date,timedelta; d=date.today(); d-=timedelta(days=d.weekday()); print(d.isoformat())')
echo "==> Entry for week starting $WEEK"
curl -s -X POST "$BASE/rest/v1/time_entries" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"user_id\":\"$USER_ID\",\"work_date\":\"$WEEK\",\"start_time\":\"08:00:00\",\"end_time\":\"17:00:00\",\"notes\":\"E2E test\"}"
echo

echo "==> Submit week"
SUBMIT=$(curl -s -X POST "$BASE/mail/timesheet/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"week_start\":\"$WEEK\"}")
echo "$SUBMIT"
echo "$SUBMIT" | grep -q email_sent_to && echo "E2E_PASS" || { echo "E2E_FAIL"; exit 1; }
