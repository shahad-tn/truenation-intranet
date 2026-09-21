# Continue here — paste this into a new chat

You are picking up the True Nation intranet project mid-stream, on Shahad's
`shahad@truenation.org` Claude account. The previous work happened on a different account and
none of its conversation, memory or artifacts carried over. Everything you need is on disk.

## THE NEXT PIECE: step 2.3 - claiming and substitutes from the portal

2.2 is WRITTEN AND COMMITTED (2026-09-21) but NOT yet verified against a real deploy - see
"Step 2.2 as built" below for what to check the moment Vercel has it.

**Build:** claiming a topic and standing in as a substitute, from the session page 2.2 just
added, reusing exactly the same path: browser -> `POST /api/classes/session`-style route ->
`runAsUser()` in `lib/appsScript.js` -> `claimTopic` / `releaseTopic` / `grabDate` /
`releaseDate` in `code.gs`. Every one of those is already written, already gated to moreh +
admin, and already tested. Nothing new is needed on the Apps Script side.

**Copy the shape 2.2 established, do not invent a second one:**
- `lib/appsScript.js` - `runAsUser(fn, params, email)`. It returns `{ok:true, result}`,
  `{ok:false, kind:"script", reason}` or `{ok:false, kind:"transport", reason}`. A SCRIPT
  error is the portal's own rule talking and is safe to show; a TRANSPORT error names
  internals (deployment, delegation, Cloud project) and must only be logged.
- `app/api/classes/session/route.js` - NextAuth identity, a moreh/admin pre-check that is
  convenience only, length limits, then the call. The Apps Script gate is the real boundary.
- `lib/classes.js` - `shapeSession()` is the ONE definition of a session, used by both the
  agenda and the detail page. Add to it rather than shaping a row anywhere else.

**After 2.3 the old Apps Script portal UI has no unique job left.** That is the point at
which retiring `index.html` becomes a real conversation.

**Also outstanding, small:**
- ~~`submitTitle` returning `getPortalState()`~~ **FIXED 2026-09-21, awaiting paste + deploy.**
  It now returns `{ ok: true }` alone. Measured in the harness: a title save went from
  **8 reads / 3 writes to 3 reads / 3 writes**, and it no longer serialises the whole
  two-class schedule back over `scripts.run`. The read saving is modest - `_MEMO` was already
  memoising tabs per execution, so this was never a 4,107-call problem - but the payload was
  real and the work was dead. `submitTitle` is the ONE write function `index.html` never
  calls, which is why only it could lose the state; **claimTopic, grabDate, releaseTopic and
  releaseDate must keep returning it** or the old UI stops repainting. In 2.3, ignore their
  state server-side rather than removing it.
- `/portal/calendar` still has the ten-class weekly rhythm HARDCODED. Second copy of the
  `classes` tab; it will drift.
- The four `_*.mjs` diagnostics in the Vercel repo are deliberately UNTRACKED - they read
  `.env.local`. Decide once whether they are committed.

## First, get access

Folder grants last one session. Call `get_device_info`, then request **both** in one call:

- `~/[vercel] truenation-intranet-directory` — the live Next.js repo
- `~/Documents/Claude/Projects/True Nation Intranet Project Build` — Apps Script sources

They mount at `$HOME/mnt/<folder-name>`; the second drops its parent path.
Full detail: `claude/device-access.md`.

## Then read, in this order

1. `claude/SYSTEM-MAP.md` — **start here.** Every deployed thing, scriptIds, deployment URLs,
   sheets, Drive folders, groups, service account. Nothing else records the scriptIds.
2. `portal-status.md` — master handoff for the Vercel portal
3. `CLAUDE.md` — brand tokens, org structure, conventions for this folder
4. `claude/class-scheduling-plan.md` — the current piece of work
5. `Claude outputs/handoff-teachers-portal.md` — the Teacher Portal in depth

## How Shahad works — read before doing anything

- **Claude edits files. Shahad runs every git command himself.** Hand him the bash block;
  never execute git.
- **Never put a `Co-Authored-By:` line in a commit message.** Shahad's standing rule
  (2026-09-21). No attribution trailer of any kind unless he asks for one.
- **No `#` comment lines inside bash blocks** — his zsh has `interactive_comments` off.
- For anything pasted into Apps Script, hand him **one `pbcopy` one-liner per file**. Never
  dump file contents into chat.
- Always **macOS paths** (`~/...`), never `$HOME/mnt/...`.
- **Everything WCAG 2.1 AA. Sans-serif always.** He is a visual learner — diagrams where they help.
- He prefers **ready-to-use documents** over guided instructions.
- **Confirm before building.** One step at a time. Ask rather than guess.
- He does not want a yes-man. Say "I don't know, let me verify" and push back when something
  is wrong. Never `.replace()` without asserting the match.
- Permissions always by Google Group, never by individual. No Google Sites.
- The repo copy is authoritative.

## Where the work stands

**Planning is complete for class scheduling, readers and graphics. Nothing is built.**
`claude/class-scheduling-plan.md` has the full design: 10 classes, ~36-42 sessions a month,
the cadence rules, teacher rotations, teacher->reader pairing tables, flagged-not-locked
status model, the two reminder clocks, per-class postpone semantics, Feast-day conflict
review, four calendars, and a 10-step build sequence.

**Step 1 is split in two.**
- **1a - written 2026-09-16, awaiting Shahad's paste and deploy.** The Teacher Portal finds
  columns by header name, `reopenCompletedCycle` is admin-only, and there is a new admin-only
  `checkColumns()`. See `SYSTEM-MAP.md` §1.2 for the deploy checks.
- **1a is DEPLOYED (2026-09-18).** `checkColumns` reported OK on all four tabs, no trigger
  existed on `reopenCompletedCycle`, the portal loads.
- **STEP 1 IS COMPLETE. The switch is DEPLOYED and verified (2026-09-19).** `owner_email` added
  and backfilled on 10 claim rows, `checkColumns` OK on all four tabs, new version deployed,
  portal confirmed working by Shahad. `retireOldTabsApply()` renamed the dead tabs:
  `zz_old_bible_basics_topics` (150 rows), `zz_old_world_history_topics` (129),
  `zz_old_overrides` (0). Nothing deleted; `class_config` kept. The drift warning is closed -
  the portal now reads and writes `topics`, `sessions`, `class_config` and `config` only.

  **STEP 2a IS DONE - RUN AND VERIFIED 2026-09-19.** `sessions` now holds **139 rows**: the 11
  that existed plus 128 generated. Verify: every class has all its dates to the 16-week horizon,
  0 missing, 0 duplicate class+date, 0 rows without a seq_no. The apply finished in seconds after
  the performance fix below. **`code.gs` was re-pasted with the `rowFor_` fix - deploy a new
  version so the live portal gets it too** (the portal works either way; it is just slow to save
  a claim without it).

  **PORTAL PHASE 1 WRITTEN 2026-09-20, NOT YET PUSHED.** Order agreed with Shahad: portal
  before calendars, and the new UI lives in **Next.js** (the Apps Script iframe is fixed at
  980px, and ten class tabs do not fit a phone). Phase 1 is READ-ONLY, so it needs no write
  path and nothing from Shahad but a deploy. In `~/[vercel] truenation-intranet-directory`:
  - `lib/classes.js` (new, 219 lines) - reads `classes`, `sessions`, `topics` in ONE batched
    call plus the staff sheet for names, same service account and pattern as `lib/staff.js` and
    `lib/announcements.js`. Read-only by design: Apps Script stays the only writer (Decision A).
    Returns the schedule from today forward; filters by class or by one person (teaching OR
    reading); resolves display names (hebrew, then legal, then the address's local part);
    marks `expectsTeacher` / `expectsReader` so a panel class or an undecided reader policy is
    not shown as a gap; returns empty rather than throwing if the sheet cannot be read.
  - `app/portal/classes/page.js` + `classes.module.css` (new) - agenda list grouped by day,
    "All classes / My assignments" and per-class filters as links (no client JS), skipped
    sessions muted, missing titles called out. Brand tokens only, AA contrast, selected filter
    marked by weight as well as colour, time moves above the class name under 560px.
  - `app/portal/PortalNav.js` - a "Classes" link for everyone signed in.
  - `app/portal/teachers/page.js` - points at the new page.
  - `_classes.test.cjs` (new) - **27 unit tests, run `node _classes.test.cjs`**. Bundles the lib
    with esbuild and swaps in a fake googleapis: no network, no credentials, no live sheet.
    Dates are built relative to today so the suite does not rot.

  **NOT verified by a real build.** `npx next build` in the desktop VM hangs: its network is
  proxied and `next/font` fetches Google Fonts at build time. Every file was parsed with esbuild,
  the CSS braces balance and every `styles.x` used exists. **The Vercel deploy is the real test**
  (portal-status.md says the same).

  **Known duplication to fix next:** `/portal/calendar` has the ten-class weekly rhythm HARDCODED
  as a list. That is now a second copy of the `classes` tab and will drift - it should read from
  the sheet or link across to `/portal/classes`.

  **STEP 2.2 WRITTEN AND COMMITTED 2026-09-21. NOT yet verified against a deploy.**
  A teacher can type a title. In `~/[vercel] truenation-intranet-directory`:
  - `lib/appsScript.js` (new) - `runAsUser(fn, params, email)`: `scripts.run` with the service
    account impersonating the signed-in person, auth lifted from `_apiproof.mjs`. Holds the
    script id and the SCOPES list, which must stay in step with the Teacher Portal's
    `appsscript.json` - the calling token must cover the SCRIPT's scopes, not just the ones the
    called function touches. Never throws; separates script errors from transport errors.
  - `app/api/classes/session/route.js` (new) - POST. NextAuth gives the identity, a moreh/admin
    check saves a round trip, lengths are capped (title 200, anchor 200, description 2000), then
    `submitTitle`. A refusal from `submitTitle` arrives as a SUCCESSFUL call returning
    `{ok:false, reason}`, not as a thrown error - the route handles both.
  - `app/portal/classes/[classKey]/[date]/` (new) - `page.js`, `SessionForm.js` (the only client
    component), `session.module.css`. Moreh and admin get the form; everyone else gets the same
    facts read-only. Brand tokens only, AA throughout, dark-mode overrides wherever `--wine`
    would be used as text.
  - `app/portal/classes/page.js` + `.module.css` - the agenda title is now the link into each
    session page, with an accessible name that says which session.
  - `lib/classes.js` - `getSession({classKey, dateISO})` added, and the row-shaping pulled out
    of `getSchedule` into ONE `shapeSession()` used by both, so the agenda and the detail page
    cannot drift about what a session is.
  - Apps Script side: `submitTitle` no longer returns `getPortalState()` - **`code.gs` must be
    re-pasted and a New version cut on BOTH deployments.** `tests/api.test.js` now asserts both
    the absence of the state and a read/write budget, so it cannot creep back.
    **`bash tests/run.sh` is 112 checks.**
  - `_classes.test.cjs` - **49 checks now, run `node _classes.test.cjs`.** The original 27 pass
    unchanged, which is what proves the refactor.

  **Three decisions worth keeping:** the session page is NOT date-windowed, so a link in a
  calendar or an inbox does not rot after the class (a past or skipped session gets a warning,
  not a locked form - there are still no timing rules); `storedTitle` is kept separate from
  `title` so the form never pre-fills a topic name as if a teacher had typed it; and
  `generateMetadata` and the page body share one read via React's `cache()`, or every view
  would cost two batched reads of four tabs.

  **NOT verified by a real build,** same as Phase 1: `npx next build` hangs in the desktop VM
  because `next/font` fetches Google Fonts and that VM has no network. Every file was parsed
  with esbuild, CSS braces balance, every `styles.x` used exists. **The Vercel deploy is the
  real test.** `_apiproof.mjs` and `_apimeta.mjs` could not be run from the desktop VM either -
  it has no route to Google at all (`oauth2.googleapis.com`, `script.googleapis.com` and
  `sheets.googleapis.com` all fail at the connection level). Run them from a networked shell.
  **If a save returns the 502 "could not reach the schedule" message, `_apimeta.mjs` is the
  first thing to run** - it prints each deployment's REAL entry-point type, which is how the
  EXECUTION_API-vs-Web-app trap shows itself.

  **PHASE 2.1 DONE, AND THE TRANSPORT IS SETTLED (2026-09-21). NO SHARED SECRET.**
  The portal's Next.js server calls the Teacher Portal's functions through the **Apps Script
  API** (`scripts.run`), with the service account **impersonating the signed-in person**.
  `Session.getActiveUser()` returns that person, so Google enforces identity: there is no secret
  to leak, no `actor` field to forge, and nothing anonymous exposed. The earlier `doPost`
  endpoint, its shared secret and the `_ACTOR` shim have all been DELETED.

  **What makes it work (all done, keep it this way):**
  - The script is attached to the **intranet-truenation** Cloud project (Project Settings > GCP
    Project). Moving it invalidates the owner's authorisation - re-run any function in the
    editor once and accept the prompt, or every API call fails with a misleading storage error.
  - **Apps Script API enabled** in that Cloud project, and ON in the user's own settings at
    script.google.com/home/usersettings.
  - A deployment whose **entry point is EXECUTION_API**, access "Anyone within True Nation".
    **THE TRAP THAT COST AN EVENING:** the type comes from the GEAR ICON in the deploy dialog,
    not the Description box. A Web app deployment named "API Executable" is still a Web app, and
    `scripts.run` then fails with "a server error occurred while reading from storage. Error code
    NOT_FOUND" - which names nothing. `_apimeta.mjs` in the Vercel repo lists deployments and
    their real entry-point types; it is the fastest way to see this.
  - Domain-wide delegation for client `105017769716672004648` now also carries: `groups`,
    `script.send_mail`, `userinfo.email`, **`calendar`** (so the Calendar blocker is CLEARED),
    plus `script.projects.readonly` and `script.deployments.readonly` for the probes.

  **Diagnostic scripts, all read-only, all in the Vercel repo:** `_apiproof.mjs` (proves identity
  end to end; `FN=apiEcho` runs the do-nothing function to separate transport from code),
  `_scopeprobe.mjs` (asks for each scope singly - delegation is all-or-nothing per request, so a
  batch failure names nothing), `_apimeta.mjs` (project visibility, Cloud project, deployments).

  **Because the API is reachable by any domain user who knows the script id, every write
  function gates itself** - `submitTitle`, `claimTopic`, `grabDate`, `releaseTopic` and
  `releaseDate` all require moreh or admin, and the admin functions call `assertAdmin_()`.
  Tested: a non-member is refused by each one.

  **Tests: `bash tests/run.sh`, 110 checks across four suites.** `endpoint.test.js` was deleted
  with the endpoint it tested; `api.test.js` replaces it.

  **(Superseded below: the original 2.1 write-up, kept for the scope decisions it records.)**
  `code.gs` gained `doPost`: the write endpoint the Next.js portal calls. It checks a shared
  secret, then **re-checks the caller's group membership against the Directory** rather than
  trusting the email it is handed, then dispatches to `submitTitle` (new), `claimTopic`,
  `releaseTopic`, `grabDate`, `releaseDate` or `ping`. Every refusal says the same thing,
  "Not available.", so a caller without the secret cannot use it to test whether an address is
  a member. `_ACTOR` carries the caller for one execution and `me_()` prefers it; it is cleared
  in a `finally`, and that is tested including the throwing case.

  **DEPLOYMENT, and why it is a second one:** the existing deployment is `access: DOMAIN`, so a
  server-to-server call from Vercel - which carries no Google session - would be bounced to a
  sign-in page. So: Deploy > New deployment > Web app, Execute as **Me**, Who has access
  **Anyone**. Same script, second URL, useless without the secret. The portal's own DOMAIN
  deployment is untouched. (The alternative, a service-account Bearer token against the DOMAIN
  deployment, I could not verify from here - noted rather than guessed.)

  **Scope decisions (Shahad, 2026-09-20):** titles AND claiming AND substitutes; **any moreh
  member or admin may edit any session**; and **no timing rules yet** - no 2-hour freeze, no
  48-hour confirm, no notifications. He is content with that while this is being built. The
  sheet still records `updated_by` / `updated_at` on every write.

  **Two real bugs this step surfaced, both fixed:** `code.gs` only knew the two hardcoded
  classes, so titles and substitutes failed for the other eight - anything that WRITES now reads
  the `classes` tab via `classCfg_()`, while the old two-tab UI still uses the `CLASSES` array.
  And `grabDate` validated dates by weekday, which cannot express a 2nd-and-4th cadence; **a
  date is now valid when a generated slot exists for it**. That last change is why three
  World History steps left `switch.test.js` - see the comment there.

  **TESTS ARE NOW IN THE REPO: `scripts/teachers portal/tests/`, run `bash tests/run.sh`.**
  Four suites, 114 checks, no network or credentials needed. Run them before pasting any `.gs`
  change. `tests/fixtures/code.v1.gs` is the pre-switch code, kept only so the equivalence
  suite can still prove the switch.

  **STILL TO DO for 2.2:** the shared secret. Shahad generates it (`openssl rand -base64 32`),
  puts it in Vercel as `SCHEDULING_SHARED_SECRET` (Production + Preview + Development, then
  redeploy) and in Apps Script under Project Settings > Script Properties with the same name.
  Until it is set the endpoint refuses everything, which is the safe default.

  **AFTER Phase 1: Phase 2** - submitting titles and claims from Next.js, which is where the
  write path gets built (one Apps Script endpoint, shared secret in Vercel env + Script
  Properties, identity from NextAuth re-checked against the group on the Apps Script side).

  **THEN step 2b** - empty calendar events per session, four calendars. Needs the four calendars
  to exist and the deploying account to have edit rights; the public Classes calendar still has to
  be created (plan §7). Apps Script auto-scopes, so the Calendar permission is a re-authorisation
  prompt, not an admin console change.

  **Step 2a as built (2026-09-19).** `scripts/teachers portal/
  generate_slots.gs` (new file, runs in the Teacher Portal project, uses `code.gs` helpers):
  `generateSlotsPreview()` / `generateSlotsApply()` / `generateSlotsVerify()`, admin-only. Creates
  one session row per class per date to the horizon (16 weeks), for all TEN classes. Never
  overwrites an existing row; re-running reports 0 new. Assignments are written once and never
  recomputed. `code.gs` gained `classes`, `class_teachers` and `reader_pairs` in `TAB_COLS`, so it
  must be re-pasted with it. Rotation anchors from Shahad: Los Discipulos starts Ash, Stick to the
  Script Banayah, Room 144 Izar Ahla (position 2); written back to the `classes` rows on apply so
  they cannot drift. 24 checks pass, including: the dates match an independently written cadence
  calculation for all ten classes; no 5th-Thursday for a 2nd-and-4th class; rotations walk in
  order; readers resolve fixed and paired; the panel class stays empty; World History topics are
  unchanged by generation; migrated claims untouched; seq_no runs 1..n in date order; a second run
  adds nothing; and a skipped session costs only that teacher his turn while nobody else moves
  (Decision C, Reading B, demonstrated on the migrated Feast-day row).

  **PERFORMANCE BUG, found the hard way 2026-09-19 and fixed. Measured: 4,107 API calls -> 15.**
  The first `generateSlotsApply()` ran three minutes before Shahad cancelled it, and had written
  NOTHING (the sheet still held its 11 rows). Two causes, both now fixed and both measured:
  1. `rowFor_` (in `code.gs`, also used by `writeSession_` and `setCfg_`) called
     `sheet.getLastColumn()` **in the loop condition** - one API read per column per row, ~4,000
     calls for 128 rows. Hoisted out of the loop.
  2. The generator asked the sheet for its width once per row, and filled `seq_no` one cell at a
     time. Both batched: the width is read once, `seq_no` is one whole-column `setValues`.
  Now: **11 reads + 4 writes** for 128 rows. A teacher's claim costs 9 reads + 6 writes.

  The fake-spreadsheet tests missed it because mock calls are instant, so the harness now COUNTS
  reads AND writes and fails above 40 / 12. Apply also runs the `seq_no` and anchor writes even
  when it appends nothing, so an interrupted run is finished by re-running it. **Lesson for any
  future Sheet code here: a sheet call inside a loop - especially a loop CONDITION - is a bug at
  this scale. Batch it, and count the calls in the harness.**

  **Note:** generation fills teacher gaps the old `class_config` week-of-month table left blank -
  that is the intended move to `class_teachers`. The portal still shows only its two class tabs;
  rows for the other eight exist for the calendars (2b) and the Next.js views (step 8).

  **NEXT after 2a: step 2b** - empty calendar events (see `class-scheduling-plan.md` §10).
  The Calendar blocker is largely dissolved: Apps Script auto-scopes, so it is a re-authorisation,
  not an admin console change. See `migration-checklist.md` Phase 4, corrected 2026-09-19.
  That is where dates stop being computed on the fly, `seq_no` gets assigned, rotation moves from
  `class_config` (nth) to `class_teachers` (session order), and the other eight classes appear.
  The Calendar scope blocker matters from here on.

  **What the switch was (2026-09-19).** `code.gs` now reads and writes
  the new tabs: topics from `topics`, claims as `sessions` rows, Open/Claimed derived from
  `cycle_started_on`, substitutes as `teacher_email` against `owner_email`, and
  `reopenCompletedCycle` moves the cycle start instead of clearing columns. Public API unchanged
  (18 functions, byte-identical list); `index.html` untouched. Rotation still reads `class_config`
  and dates are still computed on the fly - that is step 2, deliberately not in this paste.

  **Order matters - see the paste order in the chat/commit, but in short:** paste
  `migrate_scheduling.gs` first, run `upgradeHeadersApply()` (adds `sessions.owner_email` and
  backfills it from `teacher_email` on claim rows - the new code needs it), then paste `code.gs`,
  run `checkColumns()`, deploy, verify the portal, and only then `retireOldTabsApply()` which
  renames the three dead tabs `zz_old_*` (keeps `class_config`, deletes nothing).

  **Tested: 22 equivalence checks + 35 migration checks.** The old code on the old tabs and the
  new code on the new tabs return identical state across 24 actions. Three differences are
  deliberate and asserted as such: (1) the claimant's name is resolved from the directory at
  display time instead of read from a stored column; (2) a claim with no teaching date reads
  Claimed in the old model and Open in the new - none exist in the live sheet, which is what the
  cycleStart MATCH proved; (3) when an admin moves a claim to another date, the old code strands
  the substitute teacher on the vacated date and the new code clears it. Two behaviours were
  changed back to match the old code exactly: releasing an unclaimed topic is a silent no-op, and
  moving a claim forwards is allowed (moving one that was already taught is refused).

- **Where scheduling code lives (Shahad, 2026-09-19): the Teacher Portal project.** He wants the
  portals kept as separate Apps Script projects as much as possible, so step 2's generation,
  reminder and calendar code goes there too - not into a new project, not into `directory`. The
  rename of the Teachers Portal is NOT pending; it keeps its name.
- **1b migration RUN AND VERIFIED 2026-09-19.** `migrationApply()` then `migrationVerify()`:
  all checks passed, no warnings. The eight new tabs exist and hold 279 topics (150 Bible Basics
  + 129 World History), 10 classes, 14 rotation rows, 14 reader pairings, 10 sessions and 13
  config rows. **The portal still reads the OLD tabs** - see the drift warning below.

  **DRIFT WARNING:** `sessions` is a snapshot taken 2026-09-19. Every claim or substitute made in
  the portal from now on writes to the old tabs only, and `sessions` silently falls behind. Either
  switch the portal to the new tabs next, or delete the `sessions` tab and re-run
  `migrationApply()` when the switch happens. Do not let anything depend on `sessions` until then.
  `cycle_started_on.bible-basics` = **2026-08-04**, written 2026-09-19. The preview reported
  MATCH on live data: 10 topics taken under the old `status` column, the same 10 under the new
  rule, 140 of 150 Open. Switching the portal changes nobody's Open/Claimed state.

- **Cycle start derived, not remembered (2026-09-19).** Shahad does not know when the current
  Bible Basics cycle began, so `cycleStartPreview()` / `cycleStartApply()` in
  `migrate_scheduling.gs` derive it: the earliest claimed teaching date. The preview proves the
  choice by comparing what the new rule makes Open against today's `status` column and reporting
  any topic the two disagree on - on clean data it reports MATCH.
- **1b migration written 2026-09-19.** `scripts/teachers portal/
  migrate_scheduling.gs` - a NEW file, `code.gs` untouched. **Self-contained**: it borrows
  nothing from `code.gs` (its own spreadsheet id, admin check, date format and header lookup, all
  `mig_`-prefixed), so it runs in the Teacher Portal project or in a project of its own. The admin
  check uses the Admin SDK when the advanced service is enabled and falls back to GroupsApp when
  it is not; if neither can answer it refuses. `migrationPreview()` /
  `migrationApply()` / `migrationVerify()`, all admin-only, all run from the editor. Read-only on
  every existing tab; refuses to run twice. Tested against a fake spreadsheet: 24 checks including
  claim+override merged to one session, substitute reader re-resolved, unknown class and missing
  date warned, idempotency, and verify catching a seeded duplicate. **Step 2 must add the new tabs
  to `TAB_COLS` in `code.gs`** - `cols_()` does not know them yet, which is why the migration
  carries its own `mig_cols_()`.
- **1b was ON HOLD by Shahad's decision (2026-09-19).** He asked whether the migration accounted
  for the other eight classes. It did not, so the full ten-class schema is being settled first:
  `claude/sheet-schema.md` (proposal, awaiting his answers to its seven open questions). It
  supersedes step 1's "one shared `sessions` tab" wording. Nothing moves until it is agreed.
  Confirmed header rows: `bible_basics_topics` A-J ending `notes` (151 rows),
  `world_history_topics` A-E ending `description` (130 rows).

### Done on 2026-09-15, not yet committed
- Teacher Portal security fix: 31 private helpers renamed `_foo` -> `foo_`. A leading
  underscore does not hide a function from `google.script.run`; only a trailing one does.
  Verified with `node --check`, all internal calls resolve, 17 intended public functions
  untouched. **Pasted and deployed 2026-09-15** - the live source no longer contains
  `_upsertOverride`. Note: a leading-underscore probe from the browser console must be run
  inside the `userCodeAppPanel` iframe; at the `top` frame `google` is undefined, which is
  expected and proves nothing either way.
- `claude/SYSTEM-MAP.md` written — the scriptIds existed only in `_clasp-pull/*/.clasp.json`
- Stale repo paths fixed in `portal-status.md` and `CLAUDE.md`
- `scripts/Members Hub/` archived (dead — unfilled `PASTE_` placeholders; live Alms is
  `scripts/directory/Code.gs:582`)
- `_clasp-pull/` archived — it had already drifted from `scripts/`. **Manual paste-and-deploy
  is the chosen flow**; clasp is not used.
- Four missing `appsscript.json` manifests restored into `scripts/`

### Blockers
1. **The service account has no Calendar scope.** Nothing calendar-related works until granted.
   See `claude/migration-checklist.md` Phase 4 for both routes.
2. ~~Staff emails~~ **RESOLVED 2026-09-19.** All 20 teachers and readers matched to
   `@truenation.org` addresses from the staff sheet and confirmed name by name with Shahad. The
   table is in `claude/sheet-schema.md`. Shahad exported the `data` tab to a CSV in this folder
   for the match - **it holds staff personal data and should not be committed** (`.gitignore` it
   or remove it once done).

### Deferred by decision
- Reader policy for World History and War for The Kingdom — slots stay empty, flag suppressed
- Thumbnail deadline — set after one real cycle
- Full handoffs for `scripts/directory/`, `scripts/announcements/`, `scripts/profile editor/`
  and the groups library — one area per session, best written when touching that code.
  `SYSTEM-MAP.md` carries enough to work safely in the meantime.

### The groups + members library
Not yet wired as a dependency by anything — that is expected, not a bug. Shahad built it to
generate lists from live Workspace data and intends to use it in future work. **It is in good
standing and stays part of this project.** Do not archive or remove it.

### Outstanding staff-data entry (confirmed not done, 2026-09-15)
Data entry, not code — the migration did not invalidate it:
- Assign all staff to departments (Bulk Edit in the directory)
- Fill Branch, Cost Center and Employment Type for every staff member
  (use the LIVE lists: Branch `Congregant/Deacon/Apostle/Judge/Bishop`;
  Cost Center `General/Youth Ministry/Worship Arts/Outreach/Administration/Operations`;
  Employment `Volunteer/Part-Time/Full-Time/Contractor/Intern`)
- Add family links via matching `family_id` values and reciprocal `spouse_email`

This blocks nothing in the class-scheduling build, but the directory is incomplete until done.

### Do NOT trust `TrueNation-Intranet-Complete-Guide.md`
It is a pre-migration snapshot. Verified 2026-09-15: its `ADMIN_EMAILS` array does not exist in
the live code (admin is by `tn-admin@` group membership), its branch/cost-centre lists and
13-column sheet schema are all wrong, it serves a non-existent `index.html`, it describes the
retired Google Sites embed as primary, and its sample HTML is off-brand blue. `SYSTEM-MAP.md`
section 8 has the full discrepancy table. The only thing it contributed was the complete
directory `/exec` URL, now recorded in `SYSTEM-MAP.md` section 1.1.
