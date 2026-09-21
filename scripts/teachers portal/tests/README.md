# Tests for the Teacher Portal scripts

    bash tests/run.sh

No network, no credentials, no live spreadsheet: `fixture.js` builds a fake Sheets API in
Node and the `.gs` files are loaded into a vm context, so they run as Apps Script will.

| Suite | What it holds the code to |
|---|---|
| `migration.test.js` | Step 1b: the old tabs are only ever READ, claims and overrides merge to one session per class per date, warnings for rows that cannot migrate, apply refuses to run twice, verify catches a seeded duplicate, header upgrade and old-tab retirement are idempotent |
| `switch.test.js` | Step 1b code switch: the OLD code on the OLD tabs and the NEW code on the NEW tabs return identical state across 24 actions. Three divergences are deliberate and asserted as such - see the comments |
| `generate.test.js` | Step 2a: dates match an independently written cadence calculation for all ten classes, rotations walk in order from the recorded anchors, readers resolve, a skipped session costs only that teacher his turn, and **the number of API calls stays small** (a per-cell write once took three minutes against the live sheet) |
| `api.test.js` | Step 2.1: what the portal can do through the Apps Script API - identity comes from Google (scripts.run impersonates the signed-in person), every write function gates itself against non-members, titles, claims and substitutes |

`endpoint.test.js` is SUPERSEDED by `api.test.js` and can be deleted - it tested a shared-secret
`doPost` endpoint that no longer exists (the Apps Script API proved out on 2026-09-21, so the
secret and the actor field were removed).

**When you change a `.gs` file, run this first.** Between them these suites have caught: a
column lookup that only knew the old tabs, two performance bugs (~4,100 API calls for one
run), a missing `owner_email` column, an interrupted run that could not be resumed, and
`code.gs` knowing only two of the ten classes.
