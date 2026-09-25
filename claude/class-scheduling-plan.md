# Class Scheduling, Readers & Graphics — Build Plan

**Status (2026-09-25): steps 1 and 2 built.** 1, 2a, 2.1 (write path) and 2.3 (inline claiming) are
deployed; 2b (empty calendar events, `create_events.gs`) is written and tested, not yet deployed.
Next: 3, 4, 7, 9, then 5. The §11 Calendar-scope blocker is cleared. `CONTINUE-HERE.md` is the live
status. Written 2026-09-15.
Read `SYSTEM-MAP.md` first for the deployed layout.

The problem: teachers decide their own class titles. Late titles block thumbnail production
for the YouTube/Facebook streams AND block readers from preparing. The fix is not a calendar
— it is a deadline with visible consequences and a safe default when it is missed.

---

## 1. The schedule — 10 classes, ~36-42 sessions a month

All times `America/Los_Angeles`. Durations 90 min except War for The Kingdom and Feed The
Sheep (~2 hours).

| Class | Day | Cadence | Time | Teacher | Reader |
|---|---|---|---|---|---|
| Q&A: On The Spot | Mon | 1st only | 7:30 pm | A-Team panel | none (whole panel) |
| Los Discipulos de la Palabra | Mon | 2nd & 4th | 7:30 pm | Ash Napash / Malaakaya swap | whichever is not teaching |
| Bible Basics | Tue | weekly | 7:30 pm | any moreh@ claims | bound to teacher |
| World History According to the Bible | Wed | weekly | 7:30 pm | rotation, fixed teach_order | open - undecided |
| Stick to the Script | Thu | 2nd & 4th | 7:30 pm | rotation by teacher count | bound to teacher |
| Blue Strip | Fri | weekly | 5:30 pm | Apostle Yashami | Izar Ahla |
| Room 144 | Fri | weekly | 7:30 pm | rotation | bound to teacher |
| Deaconstruction | Fri | weekly | 9:45 pm | Deacon Shamar | Rakab |
| War for The Kingdom | Sabbath | weekly | 2:00 pm (5:00 ET) | Bishop Yahzeqel | open - undecided |
| Feed The Sheep | Sabbath | weekly | 4:30 pm (7:30 ET) | Bishop Tazayawan | none (whole panel) |

**Literal 2nd & 4th.** A 5th Tuesday or Friday runs.

### Cadence rule shape
One schema covers everything: a weekday plus which occurrences count.
`{day:"Tue", weeks:[1,2,3,4,5]}` weekly - `{day:"Mon", weeks:[1]}` - `{day:"Mon", weeks:[2,4]}`.
No cron parser, no recurrence library.

### Teacher rotations (anchors)
- **Stick to the Script:** Banayah -> Shahad -> Raiyah -> Mathathyah. Four teachers across two
  sessions a month, so a full cycle takes two months and never aligns with a calendar month.
- **Room 144:** Banayah -> Izar Ahla -> Ash Napash.
- **Los Discipulos:** starts Ash Napash, then alternates with Malaakaya.

**Both rotations must count SESSIONS, never dates.** Neither can be derived from "which
Thursday" or "which week". Compute from the session's position in its class's own sequence —
the same index a push postponement needs.

### Teacher -> reader pairings (data, admin-editable)
- **Bible Basics:** Shahad->Uriah · Mathathyah->Iyan · Raiyah->Yashakar · Bayan->Natazach · Ahman->Zakayah
- **Stick to the Script:** Banayah->Natazach · Shahad->Yaqataza · Mathathyah->Bayan · Raiyah->Yashakar
- **Room 144:** Banayah->Mathathyah · Izar Ahla->Shahad · Ash Napash->Ahman

**~22 of ~36 reader slots resolve automatically; 5-6 sessions have no reader at all. Only ~9
a month (World History, War for The Kingdom) need a human.**

People hold several roles — Bayan teaches Bible Basics and reads Stick to the Script; Shahad
teaches both and reads Room 144. "My assignments" must merge teaching and reading into one list.

---

## 2. Data model

Split each row in two:

- **Slot** — `class_key`, `date`, `start_time`, `status`. Generated ahead from the cadence rule.
  **There is no slot table today** — slots are computed on the fly by `upcomingDays_(weekday,
  WEEKS_AHEAD)`. Storing them is genuinely new work.
- **Session** — `title`, `description`, `anchor_scripture`, `teacher_email`, `reader_email`,
  `image_file_id`, `thumb_file_id`, `template_id`, `locked_at`, and **one calendar event ID per
  calendar** (four).

Store `template_id` from day one even though Canva templates come later, or adding them is a
migration.

---

## 3. Flagged, not locked

There is no lock. Status is **derived from completeness**, not set by a person.

- **Complete** — title, description or scripture, reader resolved, thumbnail approved
- **Incomplete** — amber, naming the missing field and who owes it
- **At risk** — still incomplete inside 48 hours of air; red, escalates to leads

Calendar events are created **empty at slot generation** and fill in as fields arrive, so the
date is always visible even when the title is not.

**Three edit rules replace the lock:**
1. Outside 48 hours — edits are silent
2. Inside 48 hours — edit prompts a confirmation, and saving re-notifies reader and designer
3. 2 hours before air — title freezes

Suppress the incomplete flag for classes whose reader policy is *undecided*, or World History
and War for The Kingdom will show a permanent amber flag on ~9 sessions a month.

---

## 4. Graphics

Standing per-class ownership — one designer owns a class permanently, set once, not rebuilt
monthly. Shahad assigns them in the graphics portal **after** the build.

Flow: title lands -> designer notified (their work is blocked until then, so the notification
IS the handoff) -> they upload against the session -> status `ready for review` ->
`graphics-lead@` approves (Ratazah) -> counts as done.

No hard deadline yet. Track and display what is outstanding; set a date after one real cycle.

**Concern on record:** ~40 thumbnails a month, several designers, no shared template. Canva
templates are coming after this build. Until then last month's thumbnails are the only style
guide, which is one reason history is retained (§7).

---

## 5. The two clocks

**Monthly** — 1st slots open and empty events created · 10th dates claimed · **15th titles,
descriptions and scripture due (a flag date, not a lock)** · 16th-19th reader gaps filled and
designers work · 20th schedule published.

**Per session, 48 hours out** — reminder to teacher, reader and assigned designer, each naming
their own outstanding item. Still missing? Tone changes, escalates to `tn-admin@` + `apostles@`.

Reminders name the person and the specific gap — "Wednesday's World History has no reader" —
never a broadcast to a group.

---

## 6. Postpone and Feast days

**Per-class default.** Push for sequence classes (World History, Room 144) — the topic is
delayed, not destroyed, and everything after shifts forward **indefinitely**, not just to the
end of the month. Skip for self-contained classes.

**Feast days are NOT a blanket blackout.** Some classes continue, some do not. So the date
cannot suppress slot generation. Instead the TNIC Headquarters calendar is read on a schedule;
any session on one of its dates is flagged `Conflict - awaiting decision` and surfaced to
`tn-admin@` / `apostles@` as one review screen: a row per session, three buttons — runs as
normal / skip / push — with the per-class default pre-selected.

Exclude the monthly `TN Monthly Alms Due` event via a **configurable list of title keywords**,
not a hardcoded string.

**Push preview must show the whole generated horizon (~16 weeks), summarised:**
"Moves 16 sessions. First three: 7 Oct->14 Oct, 14 Oct->21 Oct, 21 Oct->28 Oct. Last: 20 Jan->27 Jan.
Of those: 4 have titles, 3 have approved thumbnails, 6 are claimed."
That second line is the human cost. Never shift past the horizon — regenerate beyond it.
**Name the people, not just the dates**, and **log every push and make it reversible.**

---

## 7. Calendars

**One per group plus public — four total**, each carrying the **whole schedule** with that
group's fields, not assignments only.

The deciding constraint: **Google Calendar cannot filter per person.** A group calendar looks
identical to everyone subscribed, so "only my assignments" is impossible there. Assignments-only
also hides the unfilled gaps that most need filling. Personal filtering lives in the portal.

Exclude sessions with no role for that group — the readers' calendar skips Q&A and Feed The
Sheep, because those have no reader slot at all.

Cost: ~160 event writes a month, and every title edit touches up to four events. The sync must
batch, be idempotent, and store four event IDs per session.

### Public calendar
A new world-readable **Classes** calendar so no `truenation.org` account is needed to view,
subscribe or download. Shows titles, images (as links) and teacher/reader names.

**A secondary calendar's ID is always `...@group.calendar.google.com`** — it cannot be
`classes@truenation.org`. Only a user account's primary calendar has a human address.
Recommended: create the secondary calendar, grant `tn-admin@` "Make changes and manage sharing"
for durable ownership, make it public. Use `classes@truenation.org` as a Group for notifications.

Caveats: the org-level sharing setting must permit public calendars or the option is greyed out;
Apple/Outlook poll subscriptions on their own schedule (3-24 h lag); it is world-readable and
scrapeable, so descriptions carry names and titles only, never emails or phone numbers.

---

## 8. History

**Keep everything. Default every view forward-only, make the past browsable.** ~480 sessions a
year; costs are near zero and each has a cheaper fix than deletion (filter server-side on a
date range). Benefits: teachers avoid repeats, designers get a reference library, lateness
patterns become visible, pushes become explicable, and publicly it becomes a teaching catalogue.

**Departed members' names do NOT stay on past public sessions.** Store the email, resolve the
display name at render, suppress publicly when the person is no longer in the directory. The
staff sheet's `Former Staff` tab already provides this mechanism. Internal history keeps the
real name or the lateness reporting loses its subject.

---

## 9. Where it gets built

**Editing moves to Next.js.** The month grid cannot live in Apps Script: the GAS iframe renders
at 980 px regardless of device (mobile CSS needs ~2.45x scaling), and `addEventListener` /
`closest` are unreliable in that sandbox, so no event delegation on a grid.

**Mobile first: agenda list is the default view**, week next, month grid desktop-only. Most
traffic is phones and a seven-column grid is a desktop shape. Friday holds three classes and
Sabbath two, so month cells routinely carry three chips.

**Hand-built CSS Grid / semantic `<table>`, not FullCalendar.** **Skip drag-and-drop
deliberately** — it needs a keyboard equivalent for AA anyway. Click/tab a day -> modal ->
"Move to" date field.

Ten UI tabs will not fit on a phone; the current front end builds one tab per class from
`STATE.classes` and that pattern breaks at ten.

---

## 10. Build sequence

1. **De-risk the Sheet** *(1a header-name lookup: DEPLOYED 2026-09-18. 1b on hold: the
   schema for all ten classes is being settled first - see `sheet-schema.md`, which supersedes
   the one-shared-`sessions`-tab wording below.)* — column maps (`CLAIM_COLS`, `ASSIGNED_COLS`, `OV_COLS`) to
   header-name lookup; migrate `bible_basics_topics` + `world_history_topics` into one shared
   `sessions` tab with a `class_key` column. Ten classes cannot be ten named tabs.
2. **Slot generation and the session record** — cadence rules, blackout reads, full field set
   including four calendar event IDs and `template_id`. Empty events created on generation.
3. **Teacher submission and flagging** — propose mode, the new classes, derived status, the
   48-hour and 2-hour rules.
4. **Reader resolution** — the five patterns, admin-editable pairing tables, override with
   notification, open swaps. Only ~9 slots a month need a person.
5. **Graphics pipeline** — standing ownership, upload, `graphics-lead@` approval, outstanding view.
6. **Reminders and escalation** — monthly flag-date chase plus the 48-hour per-session reminder.
7. **Calendars** — four mirrors with per-group description templates.
8. **Views** — agenda list, then week, then desktop month grid. Per-team portal areas.
9. **Postpone and Feast-day conflicts** — per-class skip/push with preview, plus the review screen.
10. **Canva generation** — optional, nothing depends on it.

---

## 11. Blockers and open items

- **BLOCKER: the service account has no Calendar scope.** Grant before step 1 so it is verified
  early. See `migration-checklist.md`.
- Reader policy for World History and War for The Kingdom — deferred, flag suppressed.
- Thumbnail deadline — deferred until a cycle has run.
- Staff emails for every named teacher and reader — pull from the staff sheet and verify.
- Which designer owns which class — Shahad assigns post-build.
