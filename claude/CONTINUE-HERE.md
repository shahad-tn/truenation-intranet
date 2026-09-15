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

**Step 1 is ready to start:** convert the Teacher Portal's hardcoded column maps
(`CLAIM_COLS`, `ASSIGNED_COLS`, `OV_COLS`) to header-name lookup, and migrate
`bible_basics_topics` + `world_history_topics` into one shared `sessions` tab.

### Done on 2026-09-15, not yet committed
- Teacher Portal security fix: 31 private helpers renamed `_foo` -> `foo_`. A leading
  underscore does not hide a function from `google.script.run`; only a trailing one does.
  Verified with `node --check`, all internal calls resolve, 17 intended public functions
  untouched. **Not yet pasted into the Apps Script editor or deployed.**
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
2. **Staff emails** for every named teacher and reader still need pulling from the staff sheet
   `1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk` and verifying with Shahad. On the old account
   Drive was connected as a personal gmail and could not see it — connect as `truenation.org`.

### Deferred by decision
- Reader policy for World History and War for The Kingdom — slots stay empty, flag suppressed
- Thumbnail deadline — set after one real cycle
- Full handoffs for `scripts/directory/`, `scripts/announcements/`, `scripts/profile editor/`
  and the groups library — one area per session, best written when touching that code.
  `SYSTEM-MAP.md` carries enough to work safely in the meantime.

### Open question
The groups+members Apps Script **library** (v5) is declared as a dependency by no manifest in
this project. Either something not captured here consumes it, or it is orphaned.
