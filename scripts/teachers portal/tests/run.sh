#!/bin/bash
# Every suite. Run from the "teachers portal" folder:  bash tests/run.sh
#
# Each suite is a fake spreadsheet in Node: no network, no credentials, no live sheet.
# fixture.js builds that fake and is prepended to each suite. The .gs files are loaded
# into a vm context, so they are tested exactly as Apps Script will run them.
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d)
fail=0
run() {
  cat tests/fixture.js "tests/$1" > "$T/$1"
  printf '%-22s ' "$1"
  if out=$(node "$T/$1" "${@:2}" 2>&1); then
    echo "$(grep -c '^PASS' <<<"$out") checks passed"
  else
    echo "FAILED"; grep -E '^FAIL' <<<"$out" | head -20; fail=1
  fi
}
run migration.test.js migrate_scheduling.gs
run switch.test.js
run generate.test.js
run api.test.js
rm -rf "$T"
exit $fail
