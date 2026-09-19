# Sheet schema for all ten classes — proposal

**Status: proposal. Nothing built, no data moved.** Written 2026-09-19, for Shahad's review.
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
| `rotation_anchor_seq`, `rotation_anchor_position` | Where the rotation cycle starts (see below) |
| `active`, `display_order` | |

Filled in from the plan's table:

| class_key | weekday | weeks | start | teacher_mode | topic_mode | reader_mode |
|---|---|---|---|---|---|---|
| `qa-on-the-spot` | Mon | 1 | 19:30 | panel | none | none |
| `los-discipulos` | Mon | 2,4 | 19:30 | rotation (2) | none | pair (the one not teaching) |
| `bible-basics` | Tue | all | 19:30 | claim | claim | pair |
| `world-history` | Wed | all | 19:30 | rotation | sequence | open |
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

**Teacher.**
- `fixed` — `fixed_teacher_email`.
- `panel` — nobody; the field stays empty and is never flagged.
- `rotation` / `sequence` — position `((seq_no - rotation_anchor_seq) mod n) + 1` in
  `class_teachers`. Counting sessions, not dates, is what makes the four-teacher two-month cycle
  work.
- `claim` — empty until a teacher claims the date, then written onto the session.

**Topic.** `sequence` classes take the catalogue in `teach_order`, offset the same way from the
anchor. `claim` classes take whatever topic the claiming teacher picked. `none` classes have no
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

## Open questions — I need answers before building

1. **Does a skipped session consume a teacher's turn?** My proposal: no. The teacher stays with
   the session record, so a pushed session carries its teacher forward and a skipped one costs
   that teacher their turn only if you say it should.
2. **Class keys.** The ten above are my slugs. They end up in calendar entries and URLs, so say
   if you want different ones.
3. **Los Discipulos as a two-person rotation** — the plan says Ash Napash and Malaakaya swap, and
   whoever is not teaching reads. Modelling it as a rotation plus a two-row pair table gives that
   for free. Confirm that is right.
4. **Q&A and Feed The Sheep have no reader and Q&A has no single teacher.** Both are panels.
   Confirmed?
5. **Start times and durations** above come from the plan's table. Confirm before they become
   calendar entries people rely on.
6. **Staff emails.** Still the open blocker: every teacher and reader named in the plan needs a
   verified `@truenation.org` address from the staff sheet. Nothing that assigns people can be
   tested until then.
7. **Calendar scope on the service account** — still not granted, still blocks anything that
   writes events.

## What I am not proposing to change yet

The Teacher Portal front end. Ten tabs will not fit on a phone, and the plan already says editing
moves to Next.js with an agenda list as the default view. That is step 8. Until then the portal
keeps its current two tabs and gains nothing.
