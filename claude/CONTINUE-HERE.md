# Continue here — paste this into a new chat

You are picking up the True Nation intranet project mid-stream, on Shahad's
`shahad@truenation.org` Claude account. The previous work happened on a different account and
none of its conversation, memory or artifacts carried over. Everything you need is on disk.

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
  Also still blank: `config` row `cycle_started_on.bible-basics`, which the reworked cycle reset
  needs.

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
