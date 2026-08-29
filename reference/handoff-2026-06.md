# True Nation Intranet — Session Handoff (June 2026)

> **Start every new session by reading `CLAUDE.md` first** — it has the full project
> context, org structure, brand tokens, CSS class systems, and file layout.
> This document captures what changed in the June 2026 work sessions and what still needs doing.

---

## Platform Correction (Critical)

**Everything is Apps Script — NOT AppSheet.**
`CLAUDE.md` has an incorrect note saying "AppSheet app built." Ignore it. All dashboard
and directory logic runs via Google Apps Script standalone web apps and HTML embeds.
`Session.getActiveUser().getEmail()` is how users are identified.

---

## What Was Completed This Session

### 1. Profile Editor Web App — Full Rebuild

Two files in `scripts/` were completely rewritten. They need to be **copied into the
profile editor standalone Apps Script project** and deployed as a new version:

**`scripts/profile-editor.gs`** — Server-side logic
- `PE_CONFIG.EDITABLE_COLS` now covers 25 fields across 7 categories
- `PE_CONFIG.READONLY_COLS`: `branch`, `department`, `title_role`, `employment_type`
- Fixed: column name is `location` (not `campus`) for the campus field
- Writes to `ec2_name/phone/relationship` columns for Emergency Contact 2
  (the old `emergency_name2/phone2/relationship2` columns can be manually deleted from the sheet)
- `doGet()` injects `campuses` JSON array as a template variable
- Audit log format: `[timestamp, email, email, 'self_profile_update', 'multiple', '', summary]`

**`scripts/profile-editor-ui.html`** — Client-side form
- 7 sections: Name & Identity · Contact · Campus · EC1 · EC2 · Skills & Ministry · Insurance
- No page header (removed "True Nation Intranet" and "Update Your Profile" titles)
- Shows slim email indicator bar instead: `Editing profile for <email> · Blank fields are left as-is.`
- Gender: Male/Female dropdown
- Campus: 7-option dropdown (Los Angeles CA, Detroit MI, Macon GA, Manila PH, Cebu PH, Kumasi GH, Accra GH)
- Read-only context bar shows Branch / Department / Role / Employment Type
- Only changed fields are written (blank = no change)
- Success message lists field names that were updated

**Deployment URL (do not change):**
```
https://script.google.com/a/macros/truenation.org/s/AKfycbzvYnsSNAUzqif4FLxGa00w7T5FEQaF7lXY5hOMPbDmLPvluaGzg5KX5LF6f5Y3-1tK/exec
```
To redeploy: **Deploy → Manage Deployments → Edit (pencil) → New version → Deploy**
(Same URL, no Sites changes needed.)

---

### 2. Dashboard Embeds — New and Updated

**`embeds/dashboard/dashboard-quick-actions.html`** — Updated
- Removed "Update Profile" tile
- Now: **Submit Announcement** (📢, orange) + **Submit Request** (📋, blue)
- Both `href="#"` placeholders — processes not yet built
- Replace Google Sites embed with this new file

**`embeds/dashboard/dashboard-my-profile.html`** — New file
- Place on My Dashboard page **below the Upcoming Events embed**
- Add a native Sites heading "MY PROFILE" above it
- TNIC-branded card wrapping the profile editor iframe
- Height: 2200px desktop / 2800px mobile (sized to eliminate internal scrolling)
- Iframe `src` = profile editor deployment URL above

**My Dashboard page order (top to bottom):**
1. Identity Card (`dashboard-identity.html`)
2. Quick Actions (`dashboard-quick-actions.html`) — **updated**
3. My Department (`dashboard-my-department.html`)
4. Upcoming Events (`dashboard-events.html`)
5. My Profile (`dashboard-my-profile.html`) — **new**

---

### 3. Staff Directory Apps Script — Pending Manual Updates

These changes are in `scripts/CODE_GS_UPDATES.md` with exact copy-paste snippets.
They live in the **True Nation Staff Directory Apps Script project** (not the profile editor project).

**`Code.gs`** — Find `SELF_ALLOWED_COLUMNS` in `updateSelf()` and expand it to:
```javascript
var SELF_ALLOWED_COLUMNS = [
  "hebrew_first", "hebrew_last",
  "legal_first", "legal_middle", "legal_last",
  "gender", "date_of_birth",
  "phone", "personal_email",
  "home_address", "address1", "address2", "city", "state", "zip",
  "location",
  "emergency_name", "emergency_phone", "emergency_relationship",
  "ec2_name", "ec2_phone", "ec2_relationship",
  "skills", "ministry_interests",
  "insurance_provider", "insurance_policy", "insurance_dependents",
];
```

**`userdirectory.html`** — Add to the self-edit modal Contact tab:
- Gender `<select id="s-gender">` with Male/Female options
- Date of Birth `<input id="s-dob" type="date">`
- Campus `<select id="s-campus">` with 7 campus options

Pre-fill on modal open (match whatever pattern is used for existing fields):
```javascript
document.getElementById('s-gender').value = profile.gender        || '';
document.getElementById('s-dob').value    = profile.date_of_birth || '';
document.getElementById('s-campus').value = profile.location      || '';
```

Add to `saveSelf()` → `sheetData` (uses `getVal()` helper, not `getElementById`):
```javascript
gender:        getVal('s-gender'),
date_of_birth: getVal('s-dob'),
location:      getVal('s-campus'),
```

---

### 4. Master Reference — Cleaned Up

**`reference/TNIC_All_Pages_Embeds.html`**
- 13 deprecated sections removed (134 sections remain)
- `dashboard_quick_actions` block updated to match new file
- `dashboard_my_profile` block added (new section between quick-actions and my-department)

**`archive/TNIC_Deprecated_Embeds.html`** — New file
- Holds the 13 archived sections with navigation index and "do not use" warnings
- Sections archived: home_banner, home_quicklinks, finance_* (×5), production_art,
  youth_development_subgroup_cards, scica_summit, ministries_sanhedrin,
  it_logistics, clerical_the_people

---

## Key Technical Facts

### Apps Script Projects (Two Separate Projects)

| Project | Purpose | Has `doGet()`? |
|---------|---------|----------------|
| **True Nation Staff Directory** | `userdirectory.html` web app — full directory, search, admin panel | Yes |
| **Profile Editor (standalone)** | `profile-editor.gs` + `profile-editor-ui.html` — self-service My Dashboard form | Yes |

**Never merge these** — two `doGet()` functions in one project causes a collision.

### Staff Data Sheet
- ID: `1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk`
- Tab for active members: `data`
- Audit log tab: `Audit Log`
- Column for campus: `location` (NOT `campus`)
- Emergency Contact 2 columns: `ec2_name`, `ec2_phone`, `ec2_relationship`
  (old columns `emergency_name2/phone2/relationship2` are to be manually deleted)
- `hebrew_first` and `hebrew_last` are the PRIMARY display names going forward
  (`display_name` is legacy — do not use as the primary name field)

### Naming Conventions
- No "preferred contact email" fields — all TN business uses `@truenation.org` only
- "Ministries" as a Judges Branch department name is intentional and correct
- "Everyday Sheeple" is a department name (not a sub-group); PARADOX is a sub-group under it
- "Performing Arts" moved from Deacons → Apostles
- "Logistics" moved from IT → Clerical

---

## Remaining Work

### Immediate (deploy to make live)
- [ ] **Deploy profile editor** — Copy `profile-editor.gs` + `profile-editor-ui.html` into
  the standalone Apps Script project → Manage Deployments → New version
- [ ] **Update Staff Directory** — Apply `Code.gs` and `userdirectory.html` changes from
  `scripts/CODE_GS_UPDATES.md`
- [ ] **Update Google Sites** — Replace `dashboard-quick-actions` embed, add
  `dashboard-my-profile` embed below Events on My Dashboard page
- [ ] **Delete sheet columns** — Manually remove `emergency_name2`, `emergency_phone2`,
  `emergency_relationship2` from the `data` tab of the Staff Data Sheet

### Content (fill placeholders)
- [ ] **17 leadership bio cards** — `[REPLACE]` placeholders in `embeds/leadership/`
  files need real bio content for each leader
- [ ] **Campus location details** — Real addresses, service schedules, Google Maps embeds
  for 5 campuses in `embeds/locations/locations-cards.html`
- [ ] **Google Calendar embed** — Connect real calendar feed in `embeds/calendar/calendar-embed.html`
- [ ] **`[Lead TBD]` placeholders** — Open leads to fill when confirmed:
  - Marketing dept (`embeds/departments/apostles/marketing-subgroup-cards.html`)
  - Performing Arts Dance (`embeds/departments/apostles/performingarts-dance.html`)
  - Safety & Facilities dept (`embeds/departments/deacons/safety-facilities-subgroup-cards.html`)
  - CBD ops deacon (`embeds/departments/deacons/cbd-subgroup-cards.html`)
  - Stewardship dept (`embeds/departments/deacons/stewardship-subgroup-cards.html`)
  - Custodial Cleaning crew (`embeds/departments/deacons/custodial-cleaning.html`)

### New pages to build
- [ ] **Submit Announcement process** — Google Form + backend; wire into quick-actions tile
- [ ] **Submit Request process** — Google Form + backend; wire into quick-actions tile
- [ ] **Holistic Health sub-group pages** — C.A.R.E. and G.R.O.W. With Us pages
  need to be created or updated under `embeds/departments/deacons/health-*.html`

### Future (lower priority)
- [ ] **hebrew_first / hebrew_last data migration** — Many staff records still have legacy
  `display_name` as the primary name. Needs a data cleanup pass.
- [ ] **`people-profile-form.html` status** — File exists at `embeds/people/people-profile-form.html`
  but its purpose is undecided. It currently embeds the profile editor URL.
  Decision pending on whether it stays, gets redirected, or is removed.
- [ ] **Master reference base64 previews** — About 40 new/changed embeds from the June 2026
  rebuild don't yet have updated base64 iframe previews in the master reference.

---

## File Quick-Reference

```
scripts/
  profile-editor.gs           ← REBUILT this session — copy to Apps Script
  profile-editor-ui.html      ← REBUILT this session — copy to Apps Script
  CODE_GS_UPDATES.md          ← Instructions for Staff Directory project changes
  staff-directory-sync.js     ← Daily Workspace sync (read-only reference)

embeds/dashboard/
  dashboard-identity.html     ← Unchanged
  dashboard-quick-actions.html ← UPDATED this session
  dashboard-my-department.html ← Unchanged
  dashboard-events.html       ← Unchanged
  dashboard-my-profile.html   ← NEW this session

reference/
  TNIC_All_Pages_Embeds.html  ← Master reference (source of truth, updated)
  TNIC_Department_Embeds.html ← Department-only reference
  handoff-2026-03.docx        ← READ-ONLY legacy reference
  handoff-2026-06.md          ← This document

archive/
  TNIC_Deprecated_Embeds.html ← NEW this session (13 deprecated sections)
```
