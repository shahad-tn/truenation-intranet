# TNIC Teacher Portal — Setup & Deployment

One gated Apps Script web app with a tab per class (Bible Basics, World History, Admin), plus a public read-only schedule for member pages. Files: `scripts/bible-basics-portal/` (`Code.gs`, `index.html`, `denied.html`, `public.html`). Data: the four CSVs in `reference/`.

---

## Step 1 — Backend sheet: four tabs

In one Google Sheet, create these tabs (File → Import → Upload each CSV → **Import location: Insert new sheet**, then rename the tab to match exactly):

| Tab name | From CSV | Holds |
|---|---|---|
| `bible_basics_topics` | `bible_basics_topics.csv` | 150 claim-mode topics |
| `world_history_topics` | `world_history_topics.csv` | 129 topics, in teaching order (`teach_order`) |
| `class_config` | `class_config.csv` | Teacher rotation for both classes — **admin-editable** |
| `overrides` | `overrides.csv` | Admin overrides (starts empty, header only) |

Copy the spreadsheet ID from the URL: `.../spreadsheets/d/`**`ID`**`/edit`.

> World History cycles through however many rows are in its tab. The PDF gave 129 topics (its title says 150). If you want the full 150, just add rows with the next `teach_order` numbers — the sequence extends automatically.

---

## Step 2 — Apps Script project

1. script.google.com → **New project**.
2. Paste `Code.gs`. Add four **HTML** files named exactly `index`, `denied`, `public` (paste the matching files).
3. In `Code.gs` set `SPREADSHEET_ID`. Confirm `MOREH_GROUP`, `ADMIN_GROUPS`, and the World History anchor:
   - `startTopicId: 'WH-029'` — "Saul, David, and Solomon in World Context"
   - `startDateISO: '2026-07-29'` — **set this to the first Wednesday of the cycle at go-live.** Everything else computes from it.

---

## Step 3 — Enable the Admin SDK

Editor → **Services (＋)** → **Admin SDK API** → Add. Then enable **Admin SDK API** in the linked Google Cloud project (Project Settings shows which one). Used for the Moreh gate and the three admin groups.

---

## Step 4 — Deploy

**Deploy → New deployment → Web app.**
- **Execute as:** **Me** — an account that can read the groups (super admin, delegated admin with Groups read, or owner/manager of the groups). This is required for gating.
- **Who has access:** **Anyone within truenation.org**.

Copy the **/exec** URL. (Do **not** use "Execute as: User accessing" — the group checks would fail for regular teachers.)

---

## Step 5 — Test

| Test | Expected |
|---|---|
| Open as a Moreh teacher | Portal loads with tabs: Bible Basics, World History, My teaching |
| Open as a non-Moreh domain user | "Teachers only" page |
| Bible Basics → claim a topic | Lands on your Tuesday, leaves the bucket |
| Two claims on the same Tuesday | One wins; other sees "just taken" |
| World History tab | Schedule with your Wednesdays highlighted; each row shows the in-order topic + rotation teacher |
| Any teacher taps **Teach this date** (either class) | They become the teacher for that one session; rotation and topic unchanged |
| Substitute taps **Give back** | Date reverts to the rotation teacher |
| Rotation owner grabs a date a sub took | They reclaim their own slot (override cleared) |
| Open as an admin (tn-admin / apostles / bishops) | An **Admin** tab appears |
| Admin → change a rotation slot | Schedule updates to the new teacher |
| Admin → World History → Edit a date | Reassign teacher, change topic, or cancel; "Reset to default" clears it |
| Admin → reorder a WH topic | Sequence shifts from that point on |

---

## Step 6 — Embed

**Teacher portal** (gated): Bible Basics page (or a "Teachers" page) → Insert → Embed → By URL → the **/exec** URL.

**Public schedules** (open, read-only) for member-facing pages — add `?view=public` and optionally a class:
- Bible Basics: `…/exec?view=public&class=bible-basics`
- World History: `…/exec?view=public&class=world-history`
- Both: `…/exec?view=public`

Embed those on the public Bible Basics / World History pages. They need no Moreh membership (just a domain sign-in from the deployment setting).

---

## Step 7 (optional) — Auto-reset claim cycles

Triggers (clock icon) → Add trigger → `reopenCompletedCycle` → Time-driven → Day timer. Only resets a claim class (Bible Basics) once every topic has been taught, then emails `it@truenation.org`.

---

## How the admin actions map

| You want to… | Where | How |
|---|---|---|
| Remove a topic from a teacher | Bible Basics | Admin → schedule row → **Release**. World History → **Edit** → change/cancel |
| Add / remove / swap a teacher | Either | Admin → **Teacher rotation** → edit a slot (blank = remove) |
| Change teaching order | World History | Admin → **Teaching order** → topic + new position |
| Assign a class to a teacher | Bible Basics | Admin → **Assign a topic to a teacher**. World History → **Edit** a date |

Rotation lives in `class_config`, so adding/removing teachers never needs code. Access to each class is still the Moreh group; the three admin groups unlock the Admin tab.

---

## Config quick-reference (`Code.gs`)

| Setting | Value |
|---|---|
| `SPREADSHEET_ID` | _your sheet ID_ |
| `MOREH_GROUP` | `moreh@truenation.org` |
| `ADMIN_GROUPS` | tn-admin, apostles, bishops |
| Bible Basics | Tue · claim · rotation in `class_config` |
| World History | Wed · assigned · anchor `WH-029` from `startDateISO` |
| `WEEKS_AHEAD` | `16` |

---

## Later — Google Calendar sync (not built)

Add a `syncToCalendar()` that writes each scheduled class to a shared "TNIC Classes" calendar (title = topic, date, teacher). Bolts on without touching claiming/assignment. Flag me when ready.
