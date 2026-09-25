# Continue here — paste this into a new chat

You are picking up the True Nation intranet project mid-stream, on Shahad's
`shahad@truenation.org` Claude account. Everything you need is on disk.

## THE NEXT PIECE: step 3 - status flags ONLY

**Order agreed 2026-09-25:** 3 status flags -> 4 reader resolution -> 7 calendar sync -> 9 postpone
and Feast days. Graphics (5) after those. Design: `class-scheduling-plan.md` §3 and §10.

**Scope decided by Shahad 2026-09-25: the flags only.** The edit rules (48-hour confirm and
re-notify, 2-hour title freeze) stay deferred; any moreh member may still edit any session. The
notification half overlaps step 6 (reminders) and waits for it.

**What a flag is (plan §3).** Derived from completeness, never set by a person, nothing stored:
- **Complete** - everything the session needs is there
- **Incomplete** (amber) - names the missing field AND who owes it
- **At risk** (red) - still incomplete inside `risk_hours` (config, 48) of air; plan says it escalates
  to leads, but escalation is step 6 - step 3 only SHOWS it

**Where it likely lives: the Next.js portal, not Apps Script.** It is read-only and derived, and the
portal already reads the sheet (`lib/classes.js`, `getSchedule` / `getSession`) - no status logic
exists there yet (checked 2026-09-25). One pure function, e.g. `sessionStatus(session, class, now)`,
used by both the agenda (`/portal/classes`) and the session page, tested in `_classes.test.cjs`.
Confirm this placement with Shahad before building.

**Open questions to put to Shahad BEFORE building** (do not guess):
1. **What "complete" requires today.** Plan: title, description OR scripture, reader resolved,
   thumbnail approved. Thumbnails are step 5, not built - so should "thumbnail approved" be left
   out until then? (Otherwise every session is amber forever.)
2. **Who owes what.** Title/description/scripture -> `teacher_email` (blank for Bible Basics until
   claimed, and for Q&A which is a panel - who owes it then?). Missing reader -> who? (`apostles@`
   coordinates readers per SYSTEM-MAP §5.)
3. **Suppression.** `flag_missing_reader` on the `classes` tab is false for World History, War for The
   Kingdom, Q&A and Feed The Sheep - their missing reader must never raise a flag (plan §3; reader
   policy deferred). Q&A and Feed The Sheep have no reader at all.
4. **Who sees flags.** Everyone read-only, or moreh/admin only? And is there a "my incomplete
   sessions" filter (the agenda already filters "my assignments")?
5. **Look.** Amber/red must meet WCAG 2.1 AA: text label plus icon, never colour alone; brand tokens
   in `CLAUDE.md`. Gold is never text.

**Data already there:** `sessions` has `title`, `description`, `anchor_scripture`, `teacher_email`,
`reader_email`, `reader_source`, `thumb_status`, `state`; `classes` has `reader_mode`,
`flag_missing_reader`, `teacher_mode`; `config` has `risk_hours` 48 and `freeze_hours` 2.
Skipped sessions get no flag.

### Step 2b - DONE 2026-09-25: deployed, run, verified

`scripts/teachers portal/create_events.gs`. All four calendars exist; ids are in `SYSTEM-MAP.md` §4
and in the file's `EV_CALENDAR_IDS` (used only by `setCalendarIds()`, which copies them into the
`config` tab's `cal_id_*` keys; at run time the ids come from `config`).

- Admin-only: `setCalendarIds()`, `createEventsPreview()`, `createEventsApply()`, `createEventsVerify()`
- Teachers and Public get every class; Readers skip `reader_mode` none (Q&A, Feed The Sheep);
  Graphics skip Q&A only (Shahad, 2026-09-25). Today onward, never `skipped`.
- Empty event = class name as the title (Shahad chose "Bible Basics", not "... - title TBA"), start
  and `duration_min` in Pacific time. (A start-time-only version was tried and rolled back the same
  day: Google draws zero-length events as a thin line in week view.) Staff calendars link to the session page; public has no link
  and no names.
- ~500 events on the live sheet. Each run stops at 4.5 min and reports what is left; re-run. Every
  event is tagged `tn_session_id`, so a run that dies is adopted, not duplicated. Ids are saved
  every 20 events under the lock against a fresh read, matched by `session_id`.
- `ev_render_(role, class, session)` is the ONE place event text is decided. Step 7 reuses it.
- Tests: `tests/events.test.js`, 45 checks; `bash tests/run.sh` now runs 162.
- **Live run 2026-09-25:** preview 484 events (Teachers 127, Readers 107, Graphics 123, Public 127).
  Apply took two runs (368, then 116; ~4.5 min per 368). `createEventsVerify()`: all checks passed.
  `bible-basics-2026-09-29` (Tabernacles) was left out by both preview and verify, which only
  happens for a `skipped` row; Shahad to confirm its `state`.

**Three things step 7 / 9 must handle, found while building 2b:**
- `displayName_()` in `code.gs` takes the Workspace full name, which is the **legal name**. Before any
  name goes on an event, Apps Script needs the same Hebrew-first order as `nameMap()`, read from
  the staff sheet. Do that first in step 7.
- `deleteSession_()` still deletes rows (releasing a claim). A deleted row leaves its events behind
  on the calendars; `createEventsVerify()` reports them as "should not be there". The sync has to
  remove the events when their row goes, or stop deleting rows.
- A session **skipped after its events exist** (step 9's Feast-day skip, or any later cancellation)
  keeps its events on all four calendars until something deletes them. Removing them belongs to the
  skip action itself; until then `createEventsVerify()` flags them as "should not be there".
- New slots: when `generateSlotsApply()` adds rows (the horizon rolls forward), re-run
  `createEventsApply()` - it only creates what is missing. Step 7 should make this automatic.

### Then, smaller and still open

- **Topic catalogue as a browse view.** 2.3 put claiming inline on the session page (date-first —
  the grain the whole portal has). A read-only "what's been covered, what's left" screen would serve
  everyone, not just Moreh. Shahad chose inline knowing this; it's an addition, not a correction.
- **Retiring the old Apps Script UI (`index.html`).** Since 2.3 it has no unique job left. Nothing
  depends on removing it — a decision to put to Shahad, not a task.
- Six `_*.mjs` diagnostics in the Vercel repo are deliberately **untracked** — they read `.env.local`.
  Decide once whether they're committed.
- Three binary `reference/` files show as modified in the Apps Script repo and git can't index them
  cleanly ("Resource deadlock avoided"). Left alone; nobody has said what changed.

## First, get access

Folder grants last one session. Call `get_device_info`, then request **both** in one call:

- `~/[vercel] truenation-intranet-directory` — the live Next.js repo
- `~/Documents/Claude/Projects/True Nation Intranet Project Build` — Apps Script sources

They mount at `$HOME/mnt/<folder-name>`; the second drops its parent path.
Full detail: `claude/device-access.md`.

## Then read, in this order

1. `claude/SYSTEM-MAP.md` — **start here.** Every deployed thing, scriptIds, deployment URLs, sheets,
   Drive folders, groups, service account. Nothing else records the scriptIds.
2. `portal-status.md` — master handoff for the Vercel portal
3. `CLAUDE.md` — brand tokens, org structure, conventions
4. `claude/class-scheduling-plan.md` — the current piece of work
5. `claude/sheet-schema.md` — the ten-class schema and the staff email table

## How Shahad works — read before doing anything

- **Claude edits files. Shahad runs every git command himself.** Hand him the bash block; never
  execute git — **including read-only `git status` / `git log`.** Claude's sandbox can't delete files
  in a connected folder, so git can't clean up its own `.git/index.lock`, and the leftover lock makes
  **every later commit Shahad runs fail**. This happened 2026-09-21 and silently blocked a commit for
  hours. Recovery: `rm .git/index.lock`. To read repo state, read the files.
- **Never put a `Co-Authored-By:` line in a commit message.** No attribution trailer of any kind.
- **No `#` comment lines inside bash blocks** — his zsh has `interactive_comments` off.
- For anything pasted into Apps Script, hand him **one `pbcopy` one-liner per file**. Never dump file
  contents into chat.
- Always **macOS paths** (`~/...`), never `$HOME/mnt/...`.
- **Hebrew names always display, never legal names.** Order: `hebrew_first`+`hebrew_last`, then
  `display_name`, then legal, then the address's local part. `display_name` is free text and often
  holds a legal name, so it must never outrank the hebrew one. `nameMap()` in `lib/classes.js` is the
  only place this is decided.
- **Everything WCAG 2.1 AA. Sans-serif always.** He's a visual learner — diagrams where they help.
- He prefers **ready-to-use documents** over guided instructions.
- **Confirm before building.** One step at a time. Ask rather than guess.
- He does not want a yes-man. Say "I don't know, let me verify" and push back when something is
  wrong. Never `.replace()` without asserting the match.
- Permissions always by Google Group, never by individual. No Google Sites.
- **The repo copy is authoritative.**

## What is built and live

**Sheet (`1fmbURWbBGIFbWiUZubpY4_KR7RhnCZUGLZOsGHytoV0`).** Ten classes on shared tabs — `classes`,
`class_teachers`, `reader_pairs`, `topics`, `sessions`, `config`. 279 topics, 139 session rows out to
2027-01-09, every class date to the 16-week horizon. Old tabs renamed `zz_old_*`; nothing deleted.
A topic is **open** unless a session on or after `cycle_started_on.<class>` uses it — there is no
status column, and reopening a cycle moves that date forward rather than clearing anything.

**Teacher Portal Apps Script** (`1IXpetrVjjJ3E0LN93LuaFw-9yqBnlequeHbt5LNkEhyv1zcUdcOYvYjI`) owns
**every write** to that workbook (Decision A) — a Sheet has no queue, and two writers eventually lose
an edit to each other silently. `generate_slots.gs` generates slots; `code.gs` serves both the old
two-class UI and the portal's writes. **Tests: `bash tests/run.sh`, 162 checks, no network needed.
Run them before pasting any `.gs` change.**

**Next.js portal** (`~/[vercel] truenation-intranet-directory`) **reads** the sheet directly and
**writes only through Apps Script.** Live and confirmed working:

- `/portal/classes` — agenda for 8 weeks, filters by class and by "my assignments"; each title links
  to its session page
- `/portal/classes/<class-key>/<date>` — one session. Moreh get **Teaching this session** (claim a
  topic inline, cover a date, give either back) and **Session details** (title, anchor scripture,
  description). Everyone else sees the same facts read-only. Not date-windowed, so a link in a
  calendar or inbox doesn't rot.
- `/portal/calendar` — the weekly rhythm **read from the `classes` tab**, Pacific and Eastern, with
  `host_label` naming who leads a class
- **Tests: `node _classes.test.cjs`, 93 checks** — bundles the lib with esbuild and swaps in a fake
  googleapis, so no network, credentials or live sheet.

**The write path, settled 2.1, no shared secret.** Browser → Next.js API route → `scripts.run` with
the service account **impersonating the signed-in person** → `code.gs`. `Session.getActiveUser()` is
that person, so Google enforces identity: nothing to leak, no `actor` field to forge. Because any
domain user who knows the script id can reach the API, **every write function gates itself** —
`submitTitle`, `claimTopic`, `releaseTopic`, `grabDate`, `releaseDate` all require moreh or admin.
`lib/portalWrite.js` holds the one identity check and error mapping; a route names its Apps Script
function from a literal — never from the request body.

## Traps that have already cost time

- **EXECUTION_API deployment type comes from the GEAR ICON**, not the Description box. A Web app
  named "API Executable" is still a Web app, and `scripts.run` then fails with *"a server error
  occurred while reading from storage. Error code NOT_FOUND"*, which names nothing. `_apimeta.mjs`
  prints each deployment's real entry-point type — run it first whenever a write fails. Cost an
  evening. Also: the script must stay attached to the **intranet-truenation** Cloud project; moving
  it invalidates the owner's authorisation.
- **A sheet call inside a loop — especially a loop condition — is a bug at this scale.**
  `getLastColumn()` in a `while` condition made one run cost **4,107 API calls**; batched, 15. The
  harness now counts reads and writes and fails above budget. Keep counting.
- **`switch.test.js` is an equivalence suite against PRE-generation data.** Three `claimTopic` steps
  and the World History grab/release steps were removed from it because v1 validated dates by
  weekday while v2 requires a generated slot. **Seeding empty slots does not fix this** — a real row
  with a blank `teacher_email` beats the `class_config` rotation fallback, so v2 then differs from v1
  on rotation display. Tried and reverted. Those paths are asserted in `api.test.js` instead.
- **`Number("")` is `0`.** A blank `weekday` silently rendered as Sunday until `rhythmWhen()` rejected
  empty and non-integer values before the lookup. Guard before converting, not after.
- **`next build` hangs in the desktop VM** — `next/font` fetches Google Fonts and that VM has no
  network route to Google at all. **The Vercel deploy is the real test.** The `_*.mjs` diagnostics
  must be run from Shahad's own Terminal, not the sandbox.

## Blockers

1. None open. The public Classes calendar was created 2026-09-25. If `createEventsPreview()` says it
   cannot open a calendar, the running account needs "Make changes to events" on it.

## Deferred by decision

- Reader policy for World History and War for The Kingdom — slots stay empty, flag suppressed
- Thumbnail deadline — set after one real cycle
- No timing rules on class edits yet — no 2-hour freeze, no 48-hour confirm, no notifications. Any
  moreh member may edit any session. Shahad is content with that while this is being built; the sheet
  still records `updated_by` / `updated_at` on every write.
- Full handoffs for `scripts/directory/`, `scripts/announcements/`, `scripts/profile editor/` and the
  groups library — one area per session, best written when touching that code. `SYSTEM-MAP.md`
  carries enough to work safely meanwhile.

### The groups + members library

Not yet wired as a dependency by anything — that is expected, not a bug. Shahad built it to generate
lists from live Workspace data and intends to use it. **It stays part of this project.** Do not
archive or remove it.

### Outstanding staff-data entry (data entry, not code)

- Assign all staff to departments (Bulk Edit in the directory)
- Fill Branch, Cost Center and Employment Type for every staff member (LIVE lists: Branch
  `Congregant/Deacon/Apostle/Judge/Bishop`; Cost Center
  `General/Youth Ministry/Worship Arts/Outreach/Administration/Operations`; Employment
  `Volunteer/Part-Time/Full-Time/Contractor/Intern`)
- Add family links via matching `family_id` values and reciprocal `spouse_email`

Blocks nothing in the class-scheduling build, but the directory is incomplete until done.

### Do NOT trust `TrueNation-Intranet-Complete-Guide.md`

A pre-migration snapshot. Its `ADMIN_EMAILS` array doesn't exist in the live code (admin is by
`tn-admin@` group membership), its branch/cost-centre lists and 13-column schema are wrong, it serves
a non-existent `index.html`, and it describes the retired Google Sites embed as primary.
`SYSTEM-MAP.md` §8 has the full discrepancy table.
