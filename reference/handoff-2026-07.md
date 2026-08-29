# True Nation Intranet — Handoff Notes
**Session date:** July 2026  
**Prepared for:** Shahad (IT lead)

---

## What Was Done This Session

### 1. Dashboard Identity Card & My Department — Live Data (COMPLETED ✓)

Both dashboard embeds were rewritten from visual prototypes to **live iframe wrappers** that pull real user data from the Staff Directory sheet via Apps Script.

**How it works:**
- `profile-editor.gs` now has a widget router in `doGet(e)`:
  - `?widget=identity` → `serveIdentityWidget_()` → `buildIdentityHtml_(userData, email)`
  - `?widget=department` → `serveDepartmentWidget_()` → `buildDepartmentHtml_(userData, email)`
  - No param → full profile editor form (unchanged)
- Each widget calls `pe_getUserData_(email)` (existing function, no changes needed) and returns a full self-contained HTML page
- `buildIdentityHtml_()`: greeting (client-side time-of-day JS), Hebrew name → legal fallback, dept/branch/campus meta tags
- `buildDepartmentHtml_()`: dept icon mapped from `DEPT_ICONS` dict, title_role, branch badge, placeholder buttons

**Embed files updated:**
- `embeds/dashboard/dashboard-identity.html` — iframe src: `...exec?widget=identity`, fixed height 140px / 170px mobile
- `embeds/dashboard/dashboard-my-department.html` — iframe src: `...exec?widget=department`, fixed height 165px / 215px mobile

**Deployment URL (profile-editor.gs):**
```
https://script.google.com/a/macros/truenation.org/s/AKfycbzvYnsSNAUzqif4FLxGa00w7T5FEQaF7lXY5hOMPbDmLPvluaGzg5KX5LF6f5Y3-1tK/exec
```

**Master reference updated:** `reference/TNIC_All_Pages_Embeds.html` — both `dashboard_identity` and `dashboard_my_department` sections updated with new embed code and descriptions.

---

### 2. Congregation Introduction Presentation (COMPLETED ✓)

**File:** `TN-Intranet-Congregation-Intro.pptx` (root of project folder)

**7 slides:**
1. Title — wine bg, "TRUE NATION INTRANET", gold subtitle
2. What Is the Intranet? — 4 feature rows + dark wine panel right
3. Members Directory — 2×2 cards (Staff Profiles, Searchable, Complete Info, Self-Managed)
4. My Dashboard — 5 section cards (3+2 layout)
5. Departments — 4 branch cards (Bishops/Apostles/Deacons/Judges) with dept counts
6. Live Now / Coming Soon — split panel; bottom bar: *"Not all features are active yet · Expect updates and new features regularly"*
7. How to Access — 3 steps, gold IT contact box, *"The intranet grows with us."*

Brand colors: Wine `#7C1316`, Gold `#C9972C` (borders/fills only), Page `#E8E8EC` (was Snow `#FAF8F4`, changed 2026-08-29). Fonts: Cambria (headings), Calibri (body). Each slide has speaker notes.

Built with Node.js + PptxGenJS. Source script: `outputs/pptx-build/build.js` (temp build folder, not in project).

---

## Known Issues / Bug History

**"Exception: Malformed HTML content"** on all live embeds — FIXED  
Cause: GS file content accidentally pasted into `profile-editor-ui.html` in Apps Script editor.  
Fix: Open Apps Script editor → select `profile-editor-ui.html` → replace content with the file from `scripts/profile-editor-ui.html`.

**Platform note:** The intranet uses **Apps Script only** — NOT AppSheet. CLAUDE.md says "AppSheet app built" — ignore that line, it's outdated.

---

## Pending Work (Carry Forward)

### High Priority
- **Deploy updated profile-editor.gs** — Copy `scripts/profile-editor.gs` to the standalone Apps Script project → Manage Deployments → New version. URL stays the same.
- **Quick Actions links** — `href="#"` placeholders in `dashboard-quick-actions.html` and in `buildDepartmentHtml_()` inside `profile-editor.gs` need real Google Sites dept page URLs and Google Form URLs when confirmed.

### Medium Priority
- **Leadership bio cards** — 17 `[REPLACE]` placeholders in `embeds/leadership/` need real bio content
- **Campus location details** — real addresses, service schedules, Maps embeds for `embeds/locations/locations-cards.html` (7 cities: LA, Detroit, Macon, Manila, Cebu, Kumasi, Accra)
- **`[Lead TBD]` placeholders** — Marketing dept, Performing Arts Dance, Safety & Facilities dept, CBD ops deacon, Stewardship dept, Custodial Cleaning crew
- **Events embed** — `dashboard-events.html` is still static prototype; needs Google Calendar API integration
- **Staff Directory updates** — apply Code.gs and userdirectory.html changes from `scripts/CODE_GS_UPDATES.md` (if that file exists)

### Low Priority
- **Master reference sync** — `reference/TNIC_All_Pages_Embeds.html` needs textarea blocks + base64 previews for ~40 new/changed embeds from June 2026 rebuild (large task, do incrementally)
- **Holistic Health sub-group pages** — C.A.R.E. and G.R.O.W. With Us pages

---

## Key File Locations

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Full project context (read first in any new session) |
| `scripts/profile-editor.gs` | Apps Script — profile editor + widget routes |
| `scripts/profile-editor-ui.html` | Apps Script — profile editor UI (paste this into GAS editor) |
| `embeds/dashboard/` | All 5 My Dashboard embed files |
| `reference/TNIC_All_Pages_Embeds.html` | Master reference for all embed code |
| `reference/handoff-2026-06.md` | Prior session notes (June 2026) |
| `TN-Intranet-Congregation-Intro.pptx` | Congregation intro presentation |

---

## Apps Script Projects (Two Separate Projects — Never Merge)

| Project | Files | URL |
|---------|-------|-----|
| Staff Directory | `Code.gs` + `userdirectory.html` | Separate deployment |
| Profile Editor | `profile-editor.gs` + `profile-editor-ui.html` | `https://script.google.com/a/macros/truenation.org/s/AKfycbzvYnsSNAUzqif4FLxGa00w7T5FEQaF7lXY5hOMPbDmLPvluaGzg5KX5LF6f5Y3-1tK/exec` |

---

## Staff Sheet

`https://docs.google.com/spreadsheets/d/1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk/`

Column name for campus: `location` (not `campus`)  
EC2 columns: `ec2_name`, `ec2_phone`, `ec2_relationship`
