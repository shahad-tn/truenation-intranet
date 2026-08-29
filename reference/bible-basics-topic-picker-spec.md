# Bible Basics — Topic Picker Spec

Two build options for letting teachers log in with their `truenation.org` email, claim a topic from the bucket (first-come-first-served), and display the schedule for all to see. Pick one; both use the same backend sheet, so switching later is cheap.

_Scope: Bible Basics only. World History According to the Bible is on hold pending confirmation and can reuse this exact model when it's ready._

---

## 1. Shared data model (used by both options)

One new tab in a Google Sheet — either the existing staff sheet or a dedicated `Bible Basics` sheet (a separate sheet is cleaner and keeps class data away from member PII).

**Tab: `bible_basics_topics`**

| Column | Type | Filled by | Notes |
|---|---|---|---|
| `topic_id` | Text (unique) | You, once | Stable key, e.g. `BB-001`. Never reused. |
| `topic_name` | Text | You | The topic title shown in the bucket. |
| `description` | Text | You | 1–2 sentence summary of what the topic covers. |
| `scripture_refs` | Text | You (optional) | Anchor verses, e.g. `Gen 1–3`. |
| `status` | Text | System | `Open` or `Claimed`. Drives everything. |
| `claimed_by_email` | Email | System | Set to the teacher's `truenation.org` email on claim. |
| `claimed_by_name` | Text | System | Display name, looked up or stamped at claim time. |
| `claimed_at` | Timestamp | System | When the claim was saved — this is the tie-breaker of record. |
| `teach_date` | Date | Teacher (optional) | Which Tuesday they'll teach it. |
| `notes` | Text | Teacher (optional) | Freeform. |

**First-come-first-serve rule (both options enforce this):**

- A topic starts as `Open`.
- The first successful claim flips `status` → `Claimed` and stamps the email, name, and timestamp.
- Once `Claimed`, the topic is locked. Only the person who claimed it (or an admin) can release it back to `Open`.
- A teacher may hold more than one topic unless you cap it (cap is a one-line rule in either option — noted below).

The real design question is **what happens when two teachers tap the same open topic within the same second.** That is the single biggest difference between the two options, so it's called out explicitly in each.

---

## 2. Option A — AppSheet

Reuses the no-code platform your My Dashboard already runs on. Same login model (`USEREMAIL()`), same embed approach, nothing new to learn.

### Data
- Data source: the `bible_basics_topics` tab.
- Optional second table: your staff `data` tab, referenced read-only to auto-fill `claimed_by_name` from `display_name` via a lookup on the signed-in email.

### Security
- App-level: **Require sign-in**, restricted to your Google Workspace domain, so only `truenation.org` accounts get in.
- `USEREMAIL()` returns the signed-in teacher — no separate login to build.
- Row-level security filter so a teacher can edit (release/annotate) only rows where `claimed_by_email = USEREMAIL()`; admins (your `tn-admin` group) see and edit all.

### Views
1. **Available Topics** — deck or gallery view, filtered to `status = "Open"`. This is the bucket. Each card shows topic name + description + a **Claim** button.
2. **My Topics** — filtered to `claimed_by_email = USEREMAIL()`. Where a teacher sets `teach_date`/`notes` or releases a topic.
3. **Full Schedule** — table view, read-only, showing all `Claimed` topics with who's teaching what and when. This is the "everyone can see" display, embeddable on a member-facing page.

### The claim action
An AppSheet Action "Claim this topic" that sets:
- `status` → `Claimed`
- `claimed_by_email` → `USEREMAIL()`
- `claimed_by_name` → lookup on staff sheet (or `USERNAME()`)
- `claimed_at` → `NOW()`

The action is shown **only when** `status = "Open"` (a `Show if` condition), so a taken topic offers no claim button.

### FCFS honesty check (the limitation)
AppSheet is not transactional. If two teachers open the app, both see the topic as `Open`, and both tap Claim before their devices sync, the **second sync overwrites the first** — the app doesn't hard-block it at the row level. Mitigations:
- Set the app to **sync on start** and keep **delayed sync off**, so claims write immediately and open topics disappear fast.
- Add an AppSheet **automation bot**: on edit, if a claim lands on a row already claimed by someone else, revert and email the loser "that topic was just taken." This closes the gap but runs *after* the write, not before.
- In practice, with a handful of teachers claiming across a week (not all mashing the same button in the same second), collisions are rare. But AppSheet cannot *guarantee* zero double-claims.

### Multi-topic cap (optional)
One `Valid if` / bot rule: block a claim when the teacher already holds N topics.

### Embed into Google Sites
AppSheet gives the app a shareable web link; embed it on your Bible Basics page. Note this does **not** use your `postMessage` height-reporter — AppSheet manages its own iframe sizing, so it behaves a little differently from your hand-built embeds and gets an AppSheet chrome/frame around it.

### Effort & upkeep
- Build: ~half a day, no code.
- Upkeep: none beyond editing the topic list in the sheet.
- Cost: within AppSheet's usage tied to your Workspace; confirm your plan covers the extra app and user count.

---

## 3. Option B — Apps Script web app

A custom HTML app in the same pattern as your existing `userdirectory.html`. More control, on-brand, and — importantly — it can enforce FCFS *atomically*, which AppSheet can't.

### Auth
- Deploy the web app as **Execute as: User accessing the web app** and **Who has access: truenation.org only.**
- `Session.getActiveUser().getEmail()` returns the signed-in teacher server-side. No password, no separate login.
- Optional: cross-check that email against the staff sheet to confirm they're an approved teacher before showing the claim UI.

### Server functions (`Code.gs`)
- `getTopics()` — reads the tab, returns open + claimed lists for rendering.
- `claimTopic(topicId)` — the atomic claim (see below).
- `releaseTopic(topicId)` — only succeeds if the caller's email matches `claimed_by_email` (or caller is admin).
- `getSchedule()` — read-only claimed list for the public display.

### The claim action — true FCFS
This is the key advantage. `claimTopic` uses `LockService.getScriptLock()`:

1. Acquire the script lock (serializes all claims — only one runs at a time).
2. Re-read the topic's current `status` from the sheet.
3. If still `Open`: write `Claimed` + email + name + `NOW()`, release lock, return success.
4. If already `Claimed`: release lock, return "sorry, just taken by {name}."

Because step 2–3 happen inside the lock, two simultaneous taps can't both win. The first commits; the second is cleanly told it lost. **This is a real guarantee, not a mitigation.**

### UI (branded, accessible)
- Single HTML page served by `doGet`, styled with your tokens: Barlow Condensed headings (uppercase), DM Sans body, Wine `#7C1316` / Gold `#C9972C` (borders/fills only) / Page `#E8E8EC` (was Snow `#FAF8F4`, changed 2026-08-29).
- Bucket of open topics as cards, each with a Claim button; "My topics" section; live "who's teaching what" schedule.
- WCAG: all text meets AA contrast (Wine on Snow and Bark body text pass; Gold is used only as accent/border, never as body text on light — matches your brand rules), keyboard-operable buttons, visible focus rings, `aria-live` region announcing "Topic claimed" / "Already taken."
- Uses your standard `postMessage` height-reporter, so it drops into Google Sites exactly like every other embed you maintain.

### Member-facing display
Two clean paths: (a) the same app in a read-only mode for members, or (b) a separate lightweight "schedule" embed calling `getSchedule()` — no login needed if you want all members (not just teachers) to view it.

### Effort & upkeep
- Build: ~1–2 days of code (I can write it).
- Upkeep: it's code you own — future changes go through you or me, not a settings panel.
- Cost: free (Apps Script + Google Sites, your existing stack).

---

## 4. Side-by-side

| Factor | AppSheet | Apps Script web app |
|---|---|---|
| Guaranteed no double-claim (true FCFS) | No — mitigated, not guaranteed | **Yes — atomic lock** |
| Build effort | **~½ day, no code** | ~1–2 days, code |
| Who maintains it | You, in a settings UI | You/me, in code |
| Brand match | AppSheet frame around it | **Pixel-perfect to your tokens** |
| Fits your existing embed pattern | Partially (own iframe sizing) | **Yes (height-reporter)** |
| Reuses a skill you already have | **Yes (My Dashboard is AppSheet)** | Yes (userdirectory.html pattern) |
| Members-view without login | Doable | **Doable, cleaner** |
| Cost | Tied to Workspace/AppSheet plan | **Free** |
| Mobile app experience | **Native-feeling AppSheet app** | Responsive web page |

### Recommendation
Because Bible Basics is explicitly **first-come-first-served**, the tie-breaker is claim integrity. If you want an ironclad "no two teachers can ever grab the same topic" guarantee — and you value the exact brand look and free/owned stack — **Apps Script is the stronger fit**, and it slots into your existing embed architecture.

If speed to launch and zero-code maintenance matter more, and you're comfortable that same-second collisions are unlikely with a small teacher group, **AppSheet gets you live in an afternoon** and reuses the skill you already built the dashboard with.

Both read the same sheet, so you could even start on AppSheet to launch fast, then move to Apps Script later without touching your data.

### One decision I need from you
Should a teacher be allowed to hold **multiple** Bible Basics topics, or **one at a time**? That's a one-line rule in either option, but it changes the claim logic slightly.
