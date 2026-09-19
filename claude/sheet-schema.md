# Sheet schema for all ten classes — proposal

**Status: agreed in outline. Nothing built, no data moved.** Written 2026-09-19; questions 1-5
answered by Shahad the same day and folded in below.
Supersedes the "one shared `sessions` tab" wording in `class-scheduling-plan.md` step 1, which
was written when only two classes existed.

Read `class-scheduling-plan.md` for the rules this schema has to carry, and `SYSTEM-MAP.md` §1.2
for the Teacher Portal as deployed today.

## Why this comes before the migration

Step 1b was going to merge `bible_basics_topics` and `world_history_topics` into one tab. That
shape only fits the two classes already in the portal. The other eight break three assumptions
baked into the current code:

1. **Cadence.** A class today is one weekday, and every occurrence of it runs. Q&A is the 1st
   Monday only; Los Discipulos and Stick to the Script are the 2nd and 4th.
2. **Rotation.** `class_config` keys a teacher to *which week of the month* it is. Stick to the
   Script has four teachers across two sessions a month, so its cycle is two months long and
   never lines up with a week number. Rotations must count **sessions**, not dates.
3. **Topics.** Only two classes have a topic list. For the other eight the teacher writes a
   title per session — which is the problem the whole plan exists to solve.

Migrating into a shape that cannot hold those would mean migrating twice.

## How the tabs fit together

```
classes            one row per class - cadence, who teaches, who reads, defaults
  |
  |-- class_teachers   rotation members in cycle order (1..n)
  |-- reader_pairs     teacher -> reader, per class
  |-- graphics_owners  standing designer per class
  |-- topics           catalogue - ONLY for Bible Basics and World History
  |
  +-- sessions       one row per dated occurrence. The heart of it.
        |
        +-- push_log   every postponement, so it can be explained and reversed

config             key/value settings (calendar IDs, horizon, feast keywords)
```

`sessions` is the only tab that grows month by month. Everything else is small and
admin-maintained.

## The tabs

### `classes` — one row per class

| Column | Meaning |
|---|---|
| `class_key` | `bible-basics`, `world-history`, `room-144`, … |
| `class_name` | Display name |
| `weekday` | 0–6, Sunday = 0 |
| `weeks` | Which occurrences run: `1,2,3,4,5` weekly · `1` first only · `2,4` |
| `start_time` | `19:30`, local time |
| `duration_min` | 90, or 120 for War for The Kingdom and Feed The Sheep |
| `teacher_mode` | `claim` · `sequence` · `rotation` · `fixed` · `panel` |
| `fixed_teacher_email` | For `fixed` only |
| `topic_mode` | `claim` · `sequence` · `none` (teacher writes a title) |
| `reader_mode` | `pair` · `fixed` · `none` · `open` |
| `fixed_reader_email` | For `reader_mode = fixed` |
| `flag_missing_reader` | FALSE for World History and War for The Kingdom, so the deferred reader policy does not show a permanent amber flag |
| `postpone_default` | `push` for sequence classes · `skip` for self-contained ones |
| `skip_consumes_turn` | Does a skipped session cost that teacher their turn in the rotation? **FALSE everywhere except `stick-to-the-script`**. FALSE means nobody else moves - see Decision C (Shahad, 2026-09-19) |
| `rotation_anchor_seq`, `rotation_anchor_position` | Where the rotation cycle starts (see below) |
| `active`, `display_order` | |

Filled in from the plan's table:

| class_key | weekday | weeks | start | teacher_mode | topic_mode | reader_mode |
|---|---|---|---|---|---|---|
| `qa-on-the-spot-a-team` | Mon | 1 | 19:30 | panel | none | none |
| `los-discipulos` | Mon | 2,4 | 19:30 | rotation (2) | none | pair (the one not teaching) |
| `bible-basics` | Tue | all | 19:30 | claim | claim | pair |
| `world-history` | Wed | all | 19:30 | rotation (1 for now) | sequence | open |
| `stick-to-the-script` | Thu | 2,4 | 19:30 | rotation (4) | none | pair |
| `blue-strip` | Fri | all | 17:30 | fixed | none | fixed |
| `room-144` | Fri | all | 19:30 | rotation (3) | none | pair |
| `deaconstruction` | Fri | all | 21:45 | fixed | none | fixed |
| `war-for-the-kingdom` | Sat | all | 14:00 | fixed | none | open |
| `feed-the-sheep` | Sat | all | 16:30 | fixed | none | none |

### `class_teachers` — rotation members

`class_key`, `position` (1..n, cycle order), `teacher_email`, `active`.

Replaces `class_config`, whose `nth` column is the week-of-month model that cannot express a
two-month cycle. Los Discipulos is simply a two-member rotation.

### `topics` — catalogue, two classes only

`class_key`, `topic_id`, `topic_name`, `teach_order`, `scripture_refs`, `description`, `notes`,
`retired`.

Pure catalogue. **No claim columns.** Who teaches a topic, and when, is a property of a session,
not of the topic. This is the change that makes the merge worth doing once rather than twice.

### `sessions` — one row per dated occurrence

| Group | Columns |
|---|---|
| Identity | `session_id`, `class_key`, `date_iso`, `start_time`, `seq_no` |
| Content | `topic_id` (catalogue classes), `title`, `description`, `anchor_scripture` |
| People | `teacher_email`, `reader_email`, `reader_source` (`pair` / `manual` / `fixed`) |
| Graphics | `image_file_id`, `thumb_file_id`, `template_id`, `thumb_status`, `thumb_approved_by`, `thumb_approved_at` |
| State | `state` (`scheduled` · `skipped` · `pushed` · `conflict`), `conflict_note`, `pushed_from_date`, `push_batch_id` |
| Calendars | `cal_event_teachers`, `cal_event_readers`, `cal_event_graphics`, `cal_event_public` |
| Audit | `created_at`, `updated_by`, `updated_at`, `notified_48h_at` |

`template_id` is present from day one even though Canva templates come later, so adding them is
not another migration.

`seq_no` is the session's position in its own class's sequence, assigned at generation and never
recomputed. It is what both the teacher rotation and the World History topic order count on, and
it is why neither can be derived from the date.

### `reader_pairs`

`class_key`, `teacher_email`, `reader_email`, `active`. Admin-editable; holds the three pairing
tables from the plan (Bible Basics, Stick to the Script, Room 144).

### `graphics_owners`

`class_key`, `designer_email`, `active`. Standing ownership, set once. You assign these after the
build.

### `config`

`key`, `value`, `note`. Calendar IDs (four), horizon in weeks, the monthly flag date, the
feast-day title keywords to ignore (so `TN Monthly Alms Due` is not read as a conflict), the
48-hour and 2-hour thresholds.

### `push_log`

`push_batch_id`, `class_key`, `made_by`, `made_at`, `from_date`, `sessions_moved`, `reversed_at`,
`reversed_by`. Makes a postponement explicable and reversible, as the plan requires.

### Retired, kept for rollback

`class_config`, `overrides`, `bible_basics_topics`, `world_history_topics`. Nothing deletes them.
Once sessions carry the teacher, an "override" is just editing the session row, so the concept
disappears rather than moving.

## How each rule is computed

**Dates.** For a class, walk the horizon; keep each `weekday` whose occurrence number in its
month is in `weeks`. "2nd & 4th" is literal, so a 5th Friday runs only if `5` is listed.

**Teacher.** These rules fill a session's `teacher_email` **once, when the slot is generated**.
After that the value is data on the session and is never recomputed - see QC finding B below.
- `fixed` — `fixed_teacher_email`.
- `panel` — nobody; the field stays empty and is never flagged.
- `rotation` / `sequence` — position `((seq_no - rotation_anchor_seq) mod n) + 1` in
  `class_teachers`. Counting sessions, not dates, is what makes the four-teacher two-month cycle
  work.
- `claim` — empty until a teacher claims the date, then written onto the session.

**A skipped session does not cost a teacher their turn**, except Stick to the Script, where it
does. So the rotation counts sessions that *ran*: a session marked `skipped` is passed over when
walking the cycle, unless its class has `skip_consumes_turn` TRUE, in which case it counts as that
teacher's turn taken. A pushed session keeps its teacher and moves with them.

**Topic.** Also written at generation, not recomputed. `sequence` classes take the catalogue in
`teach_order`, offset the same way from the anchor. `claim` classes take whatever topic the claiming teacher picked. `none` classes have no
topic; the teacher writes `title` directly.

**Reader.** In order: a reader already set by hand wins; then `fixed_reader_email`; then
`reader_pairs` for that class and teacher; otherwise empty. Los Discipulos is the pair table with
two rows, each teacher pointing at the other.

**Status is derived, never stored.** Complete = title, description or scripture, reader resolved
(unless `flag_missing_reader` is FALSE or `reader_mode` is `none`), thumbnail approved. Otherwise
incomplete, and at risk inside 48 hours. Nothing is locked: outside 48 hours edits are silent,
inside 48 hours an edit re-notifies the reader and the designer, and the title freezes 2 hours
before air.

**Postpone.** `push` shifts that class's later sessions forward one slot each, carrying their
content with them, and writes one `push_log` row. `skip` marks the one session `skipped` and
leaves the rest alone.

**Feast days.** The TNIC Headquarters calendar is read on a schedule; any session on one of those
dates becomes `conflict` with the class's `postpone_default` pre-selected on the review screen.
Feast days are not a blanket blackout, so generation is never suppressed by a date.

## What this changes about step 1b

The migration becomes: create `classes`, `class_teachers`, `topics`, `reader_pairs`; copy both
catalogues into `topics` with a `class_key`; convert the current Bible Basics claims and the
`overrides` rows into `sessions` rows. Old tabs stay untouched. Then the portal reads the new
tabs, and step 2 generates slots forward rather than computing them on the fly.

## Answered by Shahad, 2026-09-19

1. **A skipped session does not cost a teacher their turn — except Stick to the Script**, where it
   does. Carried as the `skip_consumes_turn` column.
2. **Class keys confirmed**, with `qa-on-the-spot` renamed **`qa-on-the-spot-a-team`**.
3. **Los Discipulos** is a two-person rotation plus a two-row pair table, each teacher pointing at
   the other. Confirmed.
4. **Q&A has no single teacher and no reader; Feed The Sheep has no reader.** Both panels.
   Confirmed.
5. **Start times and durations** as listed. Confirmed.

## People — names resolved 2026-09-19

- **World History is taught by Ahman Ahla** — the only teacher today, but **more are coming, so
  it stays a rotation** (Shahad, 2026-09-19): one `class_teachers` row now, and adding a teacher
  later is a row, not a code change. The plan's "fixed teach_order" refers to the *topics*
  running in order, which is separate from who teaches.
- **"Izar Ahla" is Bishop Izar** — one person. He teaches Room 144 and reads Blue Strip.
- **"Bayan" and "Bayanah" are two different people.** Bayan teaches Bible Basics and reads Stick
  to the Script. Bayanah leads G.R.O.W. With Us. Do not merge them.
- **Open:** is the "Ahman" who reads Bible Basics and Room 144 the same person as **Ahman Ahla**?

## Addresses — resolved and confirmed by Shahad, 2026-09-19

Matched against the staff sheet (`data` tab) and confirmed name by name. All `@truenation.org`.

**Teachers**

| Class | `class_teachers` rows, in cycle order |
|---|---|
| `los-discipulos` | 1 `ash` · 2 `malaakaya` (alternating; whichever is not teaching reads) |
| `world-history` | 1 `ahmanahla` (more teachers coming; stays a rotation) |
| `stick-to-the-script` | 1 `banayah` · 2 `shahad` · 3 `raiyah` · 4 `mathathyah` |
| `room-144` | 1 `banayah` · 2 `izarahla` · 3 `ash` |
| `blue-strip` | `yashami` |
| `deaconstruction` | `shamaryah` |
| `war-for-the-kingdom` | `yahzeqel` |
| `feed-the-sheep` | `tazayawan` |
| `bible-basics` | none - any `moreh@` member claims a topic |
| `qa-on-the-spot-a-team` | none - panel |

**`reader_pairs`**

| Class | teacher -> reader |
|---|---|
| `bible-basics` | `shahad`->`uriahbenson` · `mathathyah`->`iyanahrayahla` · `raiyah`->`yashakar` · `bayan`->`natazach` · `ahmanahla`->`k.zakaya19` |
| `stick-to-the-script` | `banayah`->`natazach` · `shahad`->`yaqataza` · `mathathyah`->`bayan` · `raiyah`->`yashakar` |
| `room-144` | `banayah`->`mathathyah` · `izarahla`->`shahad` · `ash`->`ahmanahla` |
| `los-discipulos` | `ash`->`malaakaya` · `malaakaya`->`ash` |

**Fixed readers:** `blue-strip` -> `izarahla` · `deaconstruction` -> `rakab`.
**No reader:** `qa-on-the-spot-a-team`, `feed-the-sheep` (panels).
**Reader undecided, flag suppressed:** `world-history`, `war-for-the-kingdom`.

**Name notes, so nobody re-litigates them**

- `ahmanahla` (Ahman Ahla, Deacon) teaches World History **and** reads Bible Basics and Room 144
  — one person. `ahmanah` (Ahmanah Barayath) is someone else entirely.
- `izarahla` is Bishop Izar. `bayan` and `bayanah` are two different people.
- `k.zakaya19` is Zakayah, confirmed despite the address not following the usual pattern.
- **Staff-sheet correction owed:** the row for `shamaryah` carries the wrong name. It should read
  **Shamar**. Data entry for Shahad; nothing in this build depends on it, but the portal shows
  display names.

## Still open
7. **Calendar scope on the service account.** Not granted. Blocks anything that writes calendar
   events, which is step 7 and parts of step 2. To be walked through when that work starts.

## What I am not proposing to change yet

The Teacher Portal front end. Ten tabs will not fit on a phone, and the plan already says editing
moves to Next.js with an agenda list as the default view. That is step 8. Until then the portal
keeps its current two tabs and gains nothing.

---

# Quality-control review — 2026-09-19

Written before building 1b, at Shahad's request: stress-test the schema, question the approach,
find what breaks. Ordered worst first. **Findings A, B and D change the design; they are not
nitpicks.**

## A. Two writers on one Sheet — decide this before any code

The plan moves editing to Next.js (step 9 of the plan, §9) while the Teacher Portal stays in Apps
Script. That means **two systems writing `sessions`**: Apps Script as the signed-in user, Next.js
through the service account. Apps Script's `LockService` does not know about Next.js, and the
Sheets API does not lock. Two people editing the same session a second apart silently lose one of
the edits — exactly the failure the current claim code uses a lock to prevent.

**Recommendation: one writer.** Apps Script owns every write (it already holds the lock, has
native Calendar and Sheets access, and gets 6 minutes per run for the scheduled jobs). Next.js
owns the UI and reads, and any write it needs goes to an Apps Script endpoint. The alternative —
Next.js owns writes — means the scheduled jobs move to Vercel cron, whose function time limit is
far shorter than 6 minutes and would need the calendar sync split into chunks. I have not checked
what limit your Vercel plan allows; that check belongs in this decision.

## B. Assignments must be stored at generation, not recomputed

The schema above says the teacher is computed as `((seq_no - anchor) mod n)`. That formula and the
postpone rules contradict each other. If it is recomputed on every read, then adding a teacher to
`class_teachers`, retiring one, or pushing a session silently reshuffles who teaches dates that
teachers have already prepared titles for.

**Fix: the formula fills an empty slot once, at generation, and is then never consulted for that
row again.** `teacher_email` and `topic_id` are data on the session, not a view of the rotation.
This also fixes the same hazard for World History topics when the catalogue is edited mid-cycle.

## C. "A skip does not cost a turn" has two meanings, and one of them hurts

Room 144 on 2 Oct - 13 Nov, three teachers. The 16 Oct class falls on a Feast day and is skipped.

- **Reading A — the skipped teacher takes the next slot, everyone shifts.** Every later date
  changes hands: 23 Oct, 30 Oct, 6 Nov and 13 Nov all get a different teacher. Anyone who already
  wrote a title for their date loses it.
- **Reading B — nobody moves.** The skipped teacher simply does not teach this time round and
  comes up again when the cycle returns.

Reading B is the only one that does not rewrite dates people have prepared for. I read your
answer as B, but A is what "does not consume the turn" literally says, so please confirm which.
Stick to the Script is the opposite case and is already settled: the turn is consumed.

## D. Bible Basics cycle reset has nowhere to live

Today a topic carries `status` and the portal reopens the whole bucket when every topic has been
taught (`reopenCompletedCycle`). Once claim state moves to sessions, "Open" has no column and the
reset has nothing to read.

**Fix: `cycle_started_on` per class, in `config`.** A topic is Open if no session references it on
or after that date. Resetting the cycle sets the date to today. History stays intact, which
matters because the plan keeps history deliberately (§8).

## E. Flags must know when a blank is normal

Derived status must not flag: a panel class with no teacher (Q&A), a class with no reader
(Q&A, Feed The Sheep), an unclaimed Bible Basics date before the monthly claim date, or the two
classes whose reader policy is deferred. The `flag_missing_reader` column covers the last one;
teacher-side suppression follows from `teacher_mode` being `panel` or `claim`.

## F. One session per class per date

Nothing in the schema enforces it. The migration is where it will bite: a Bible Basics claim and
an `overrides` row can both point at the same date, and today they are two rows in two tabs. The
migration must merge them into one session and report any it could not.

## G. Numbers, checked

A year of the cadence rules gives **427 sessions, 33-38 a month**. The plan says "~36-42 a month".
Not alarming - the plan was an estimate - but the low months are worth a glance in case a class
is missing from the ten.

Calendar load: four calendars, ~36 sessions a month, ~144 event writes a month plus edits. Well
inside Apps Script's daily quota, but a single run creating 144 events will approach the 6-minute
limit, so the sync must be resumable and idempotent - which is what the four stored event IDs per
session are for.

## H. Timezone

Store `start_time` as local text and build events with an explicit `America/Los_Angeles` timezone.
The Apps Script project timezone and the spreadsheet timezone must both be set to it, or dates
drift by a day at the edges. The ET times in the plan (5:00 and 7:30 for the Sabbath classes) are
informational only - never store both.

## I. Reader re-resolution

If a session's teacher changes, a reader that came from the pair table should re-resolve and the
old reader be told. A reader set by hand must win and never be overwritten. That is what
`reader_source` is for; it needs to be written on every path that sets a reader.

## Is this the best way forward?

Two honest alternatives were weighed:

- **Do nothing structural; add the eight classes to the current tab-per-class design.** Rejected:
  the front end builds one tab per class and ten will not fit on a phone, and the week-of-month
  rotation cannot express a two-month cycle.
- **Skip the Sheet entirely and move to a real database.** Rejected for now: the Sheet is what
  makes this legible and editable by admins who are not engineers, and every other part of the
  intranet already lives in Sheets. Revisit if `sessions` outgrows it, which at ~430 rows a year
  is many years away.

The staged approach holds. The changes above are corrections inside it, not a different route.

---

# Decisions on the QC findings — 2026-09-19

## A. One writer: Apps Script. Decided.

**The problem, plainly.** A spreadsheet has no queue. If two programs write the same row at
nearly the same moment, the second overwrites the first and nobody is told. Apps Script can take
a lock so its own writes wait their turn, but that lock is invisible to anything outside Apps
Script. Two writers means a silent lost edit sooner or later.

**The decision.** Apps Script is the only thing that writes the Sheet. Next.js reads the Sheet
directly (it already does, through the service account) and renders the screens. When someone
edits, the Next.js server calls one Apps Script endpoint, which takes the lock and writes.

```
   A person in a browser
            |
            v
   Next.js  (portal.truenation.org)        reads the Sheet directly, renders screens
            |                              NextAuth already proves who the person is
            | server-to-server call, shared secret
            v
   Apps Script endpoint                    the ONLY writer
            |  takes the lock
            |  re-checks the person's group membership
            v
        the Sheet  +  the four calendars
```

**Why this way round.** Apps Script already holds the lock, already reaches Calendar and Sheets as
the signed-in org, and gets 6 minutes per run, which the monthly calendar sync needs. Putting the
writes in Next.js would move those scheduled jobs to Vercel cron, whose per-run time limit is far
shorter, and the sync would have to be chopped up to fit. **This decision also means we never have
to find out what that Vercel limit is.**

**What it requires.** A shared secret in both places (Apps Script Script Properties and a Vercel
environment variable), and the endpoint must not trust the email the caller sends: it re-checks
that person's group membership with AdminDirectory before writing. Browser-to-Apps-Script calls
are deliberately not used - an Apps Script web app redirects through `googleusercontent.com`,
which breaks cross-site calls from the portal.

**Until Next.js editing exists (step 8), nothing changes.** The Teacher Portal keeps writing
directly, because it is the only writer today.

## C. Reading B. Decided.

A skipped session does not move anybody. The teacher who was due simply does not teach that time
and comes up again when the cycle returns. No later date changes hands, so nobody loses a title
they had already prepared. **Stick to the Script is the exception**: there the turn is consumed,
which is what `skip_consumes_turn` is for.
