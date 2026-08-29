# True Nation Intranet — Claude Code Project Context

## What This Project Is

A Google Sites intranet for True Nation Israelite Congregation (TNIC), a multi-campus religious organization. The intranet is built using Google Sites (free tier) enhanced with custom HTML embeds, AppSheet, Apps Script, and Google Forms.

The project owner is **Shahad** (IT department lead). She is a visual learner — use visual explanations and diagrams when applicable.

## Page Architecture

The intranet has two top-level pages plus sub-pages:

- **Home** — Shared landing page visible to all staff. Embeds: Hero Banner, Quick Links, Announcements.
- **My Dashboard** — Personalized page filtered by `USEREMAIL()` via AppSheet. Embeds: Identity Card, Quick Actions, My Department, Upcoming Events. This is a SEPARATE page from Home (not combined).
- **Departments**, **Our People**, **T.E.L.A.**, **Calendar & Events**, **Resources / Library**, **Locations**, **Leadership Hub**, **IT / Logistics** — Standard sub-pages with embed-based layouts.

## Staff Data Sheet (Backend for Dashboard)

The existing Google Sheet at `https://docs.google.com/spreadsheets/d/1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk/` is the single source of truth for member data. It has 4 tabs:

- **data** — Active members (54 original columns + 6 added: `department`, `title_role`, `sub_groups`, `display_name`, `sync_source`, `last_synced`)
- **Former Staff** — Archived members (the "inactive" signal — anyone here is hidden from the dashboard)
- **Audit Log** — Change history
- **Data Backup (pre-migration)** — Legacy snapshot

This sheet also powers the existing `userdirectory.html` Apps Script web app. Adding columns to the end is safe and does not break the existing app.

**Apps Script sync** (`scripts/staff-directory-sync.js`): Runs daily, syncs Google Workspace users into the `data` tab. Fills `legal_first`, `legal_last`, `phone` ONLY if blank. Never overwrites hand-entered data. Stamps `sync_source` and `last_synced` metadata.

## Master Reference File (Single Source of Truth)

**`reference/TNIC_All_Pages_Embeds.html`** is the master reference. It contains every HTML embed block for the entire intranet, organized by page section, with copy buttons and live previews.

**Workflow rule:** All embed changes go into this file. Update both the standalone HTML file in `embeds/` AND the corresponding textarea block in `reference/TNIC_All_Pages_Embeds.html`. The handoff document (`reference/handoff-2026-03.docx`) is read-only reference — never modify it unless explicitly asked.

## Architecture: How Embeds Work

Each "page" in Google Sites is composed of one or more standalone HTML embeds pasted via **Insert → Embed → Embed Code**. Every embed is a self-contained HTML file with its own styles, fonts, and a height-reporter script that posts its scrollHeight to the parent frame:

```js
(function(){
  function sendHeight(){
    var h=document.body?document.body.scrollHeight:0;
    window.parent.postMessage({type:'tnic-height',height:h,id:'EMBED_ID'},'*');
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',sendHeight);}
  else{sendHeight();}
  window.addEventListener('resize',sendHeight);
  if(window.ResizeObserver){new ResizeObserver(sendHeight).observe(document.body);}
})();
```

### Master Reference Structure

Each embed block in `TNIC_All_Pages_Embeds.html` follows this pattern:

```html
<div class="master-section" id="EMBED_ID">
  <div class="master-header">
    <span class="master-filename">filename.html</span>
    <h2 class="master-label">Section Title</h2>
    <p class="master-desc">Description of what this embed does.</p>
    <button onclick="copyEmbed('EMBED_ID')" class="copy-btn">📋 Copy HTML</button>
  </div>
  <textarea id="embed-EMBED_ID" class="embed-box" readonly>
    <!-- HTML-escaped embed source goes here -->
  </textarea>
  <details>
    <summary>👁 Preview</summary>
    <iframe class="preview-iframe" src="data:text/html;base64,BASE64_ENCODED_EMBED" ...></iframe>
  </details>
</div>
```

**When updating a textarea:** The content must be HTML-escaped (`<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`, `"` → `&quot;`, `'` → `&#x27;`). The preview iframe base64 should be updated to match.

## Brand Design Tokens

Updated 2026-08-29. The identity colours (Wine, Gold) are unchanged. The
neutral surfaces moved from warm to gray — see "Why the surfaces are gray" below.

| Token | Hex | Usage |
|-------|-----|-------|
| Wine | `#7C1316` | Primary headers, links, CTAs |
| Gold | `#C9972C` | **Borders, rules, filled badges only — never text** |
| Gold (text on light) | `#785710` | Gold-coloured text on a light ground (5.4:1 on Page, 6.6:1 on Card) |
| Gold (text on wine) | `#D4A94D` | Gold-coloured text on wine (4.9:1) |
| Page | `#E8E8EC` | Page and section backgrounds (was Snow `#FAF8F4`) |
| Surface | `#D8D8DE` | Subtle fills, table headers, badges (was Cream `#F2EDE4`) |
| Card | `#FFFFFF` | Cards and panels sitting on Page |
| Line | `#BFBFC7` | Decorative borders and dividers |
| Line strong | `#86868F` | Borders of inputs and controls (WCAG 1.4.11 needs 3:1) |
| Ink | `#26262A` | Body text (was `#130D0A`) |
| Muted | `#56565E` | Secondary text (was Bark `#3D2E28`) |
| On wine | `#F2F2F3` | Any text on Wine or another dark ground (was Cream) |

In the shared stylesheet the old token *names* still work — `--tn-snow`,
`--tn-cream`, `--tn-brown`, `--tn-brown-mid` — only their values moved, so
existing embeds keep rendering. New work should prefer `--tn-line`,
`--tn-line-strong`, `--tn-onwine`, `--tn-card`, `--tn-gold-text`.

### Why the surfaces are gray

Warm Snow page + Warm Cream panels + white cards put roughly a 2% luminance
step between adjacent surfaces. Edges were hard to locate, the page read as one
flat warm field, and scanning it was tiring. The gray scale keeps the same
structure with real separation and a dimmer overall ground.

### Correction: gold was never accessible as text

The previous guide stated `#C9972C` on Warm Snow was 4.6:1. **That figure was
wrong — the true value is 2.49:1**, so gold text never met WCAG AA at any size.
This was a pre-existing defect, not a consequence of the gray change. Gold is
now documented as a fill and border colour, with two dedicated text variants.
648 gold-as-text occurrences across the embeds and the master reference were
reclassified by context on 2026-08-29.

**Non-negotiable colour rules (unchanged in spirit):** never pure black or pure
white for text; never a serif font; gold never carries body text; only `--tn-onwine`
on dark grounds.

**Typography:** Barlow Condensed (600/700) for headings, uppercase with letter-spacing. DM Sans (400/500/700) for body text.

**Google Fonts import:** `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap`

## Organization Structure

**5 Branches** (governance hierarchy, NOT geographic): Bishops > Apostles > Deacons > Judges > Congregants

**Council** = separate governance body containing Bishops + Apostles together. Council is NOT a branch.

### Bishops (4)
- Bishop Tazayawan — Los Angeles, CA (HQ) · Youth Director (T.E.L.A.) · CBD overseer
- Bishop Yahzeqel — Detroit, MI & Macon, GA (Satellite) · CoT Macon overseer
- Bishop Banayah — Manila, Philippines & Cebu, Philippines (International) · Ministries lead · Tribal Exchange oversight
- Bishop Izar — Kumasi, Ghana & Accra, Ghana (International; Accra = school only, no CoT) · Maintenance overseer

### Apostles Branch (Doctrine)
- Apostles: Ash Napash, Yashami
- 6 Departments: **Disciples**, **Marketing**, **Performing Arts**, **Everyday Sheeple**, **Publication**, **T.E.L.A.**
- **Disciples** — leads: Ash Napash, Yashami. No sub-groups.
- **Marketing** — lead: TBD. Sub-groups: Graphic Design (Ratazah), Social Media (Yaqataza).
- **Performing Arts** (moved from Deacons → Apostles) — lead: Deacon Kabash. Programs (4): Acting (Tazayawan), Dance (TBD), Music (Kabash), Poetry (Kabash). Music is ONLY a Performing Arts program — not its own dept.
- **Everyday Sheeple** (formerly Production) — lead: Yashan. Sub-groups (8): Sound (Yashami), Videography (Yashan), Photography (Yaqataza), Camera & Lights (Yashan), A/V Audio/Visual (Shamar), Stage Production (Ahman), Visual Art (Ahmaryah/Karamyah), PARADOX (Tazayawan — the media content/ministry). NOTE: Everyday Sheeple is the department name; it is NOT a sub-group. PARADOX App (software) lives in IT/Applications — not here.
- **Publication** — lead: Shamar. Sub-groups: Newsletter, Quarterly Brew.
- **T.E.L.A.** (formerly Youth Development) — Youth Director: Bishop Tazayawan. Programs (6): Intramural Sports (Tazayawan), Jr. Disciples (Ash Napash), Little Lions (Tazayawan), Maiden Ewe's (Shawashan), Naqam Freshman (Tazayawan), Naqam Varsity (Tazayawan). Youth Council = separate governing body (not the Judges Council). **Cross-functional model:** TELA support roles are joint appointments from parent departments — no parallel titles. Mathathyah (Fellowship) serves TELA from Fellowship & Service; Qawalyah (C.A.R.E.) from Holistic Health; Sarah (admin) from Clerical; Ahhabyah (fundraising) from Stewardship; Shawashan (logistics) from Clerical; Kabash (art/worship) from Performing Arts; Yashami (discipleship) from Disciples. Ashley (Events & Activities Coordinator) is TELA-specific.

### Deacons Branch (Administration & Resources)
- Deacons: Kahan, Kabash, Kanash, Ahman, Rakab, Shamar
- 10 Departments: **CBD**, **Clerical**, **Custodial**, **Fellowship & Service**, **Stewardship**, **Holistic Health & Healing**, **IT**, **Maintenance**, **Safety & Facilities**, **Textiles & Attire**. (Performing Arts moved to Apostles. E.R.T. and Security consolidated under Safety & Facilities.)
- **CBD** (Community Building) — overseer: Bishop Tazayawan; ops lead: TBD Deacon. Sub-groups (3): Camp Tazarah (Ash Napash), CoT Kumasi, Ghana (Izar), CoT Macon, GA (Yahzeqel).
- **Clerical** — lead Kabash. Sub-groups (2): Administration Committee (Sarah), Logistics (Shawashan) ← moved from IT.
- **Custodial** — lead Kawan. Sub-groups (2): Cleaning Crew, Detailing (Lawah).
- **Fellowship & Service** — leads Kahan/Kabash. Sub-groups: Fellowship (Mathathyah — org-wide, including TELA), Hospitality (Shawashan), Feast Committee → Beverages (Kabash), Ceremonial (TBD), Culinary (Kanash), Decor (Adah), Desserts (Shalawa), Sacrificial Cooking (Kahan), Serving & Catering (Lawah).
- **Stewardship** (formerly Finance) — lead TBD (to be filled). Sub-groups (4): Bookkeeping (Marayam), Fundraising (Ahhabyah), Travel (Shabayah), Tribal Exchange / Marketplace (Banayah).
- **Holistic Health & Healing** — lead Kanash. Sub-groups (2): C.A.R.E. — Committed to Aid, Restore & Encourage (lead Qawalyah; team: Shalawa, Ahmanah, Kasaya, Ishan, Kani; serves org-wide including TELA), G.R.O.W. With Us (Bayanah).
- **IT** — lead Shahad (asst Sarah, Yedayah). Sub-groups (3): Infrastructure, Website, Applications (Shahad — includes PARADOX App software platform). Logistics moved to Clerical.
- **Maintenance** — ops lead Rakab; overseer Bishop Izar. No sub-groups.
- **Safety & Facilities** — lead TBD. Sub-groups (2): E.R.T. (leads Kanash/Shamar; members: Shamar, Yashan, Malaakaya), Security (lead Ahman, asst Chaanak).
- **Textiles & Attire** — lead Kanash. Sub-groups (3): Apparel (Kanash, asst Karamyah), Faithful Seams (Kanash) — file: `textiles-faithful-seams.html`, Uniform (Qawalyah).

### Judges Branch (Righteousness)
- Council: Tazayawan, Banayah, Izar, Yahzeqel, Ash Napash, Yashami
- Departments: Counseling, Ministries (official name — keep as-is)
- **Counseling** — lead Tazayawan; coordinator Yashami. Sub-groups (1): Sanhedrin (Calendar Committee).
- **Ministries** — lead Bishop Banayah. Sub-groups (4): Elders Ministry (Banayah), Prayer Ministry (Banayah), Prison Ministry (Banayah), SOV — Sisters of Virtue (Marayam). NOTE: SOV = "Sisters of Virtue".

**NOTE:** "Ministries" as a Judges Branch department name is official and stays. The old generic "Ministries" umbrella label was replaced with "Departments" everywhere else.

## CSS Class Systems

### Department Branch Cards (`di-` prefix)
Used in `departments-index-cards.html` and all branch embeds (`departments-bishops.html`, `departments-apostles.html`, etc.):

- `.di-wrap` — Page `#E8E8EC` background wrapper (was Warm Snow `#FAF8F4`)
- `.di-grid` — CSS Grid, `repeat(auto-fill, minmax(200px, 1fr))`
- `a.di-card` — White card with hover effect (gold border + lift)
- `.di-badge` — Pill badge with branch-specific color
- `.di-name` — Wine uppercase name
- `.di-lead` / `.di-lead-label` — Gold label (`#785710` as text) + muted `#56565E` text
- `.di-arrow` — Gold arrow `→` with hover slide (`#785710` as text on light)

### Badge Colors
Badge *backgrounds* are unchanged — they are branch identity colours. Only the
text on them moved to the neutral light value.

- `.badge-bi` — Bishops: Cardinal `background: #8C1C1C; color: #F2F2F3`
- `.badge-ap` — Apostles: Blue `background: #1E3A8A; color: #F2F2F3`
- `.badge-de` — Deacons: Green `background: #1A5C2A; color: #F2F2F3`
- `.badge-ju` — Judges: Gold `background: #8B6200; color: #F2F2F3`
- TELA branch header: `background: #130D0A; color: #F2F2F3` (Black)

These classes live in `userdirectory.html`, which is **not** in this folder — it
exists only as an Apps Script deployment and a Project doc. It has not had the
gray pass applied. See `reference/standalone-apps-check.md`.

### Department Detail Cards (`tnic-` prefix)
Used in individual department embeds (e.g., `dept-subgroup-cards.html`):
- `.tnic-wrap`, `.tnic-cards`, `.tnic-card`, `.tnic-card-name`, `.tnic-card-desc`, `.tnic-card-lead`, `.tnic-action-btn`, `.tnic-coming-soon`

### Quick Links (`ql-` prefix)
- `.ql-wrap`, `.ql-grid`, `.ql-tile`, `.ql-icon`, `.ql-label`

### Announcements (`ann-` prefix)
- `.ann-wrap`, `.ann-item`, `.ann-date`, `.ann-title`, `.ann-body`, `.ann-tag`

### Dashboard Identity (`dash-` prefix)
- `.dash-id` — Wine gradient card (the identity card)
- `.dash-greeting`, `.dash-name`, `.dash-meta`, `.dash-tag`, `.dash-tag-icon`

### Dashboard Quick Actions (`qa-` prefix)
- `.qa-wrap`, `.qa-grid`, `.qa-tile`, `.qa-icon`, `.qa-label`, `.qa-desc`

### Dashboard My Department (`dept-` prefix, dashboard-specific)
- `.dept-wrap`, `.dept-card`, `.dept-row`, `.dept-icon`, `.dept-info`, `.dept-name`, `.dept-lead`, `.dept-links`, `.dept-btn`, `.dept-btn-primary`, `.dept-btn-secondary`

### Dashboard Events (`events-` prefix)
- `.events-wrap`, `.event-item`, `.event-date-box`, `.event-month`, `.event-day`, `.event-info`, `.event-title`, `.event-time`, `.event-campus`, `.events-footer`

## Campuses (6 locations, 8 cities)

| Campus | Bishop | Type | Notes |
|--------|--------|------|-------|
| Los Angeles, CA | Tazayawan | HQ | |
| Detroit, MI | Yahzeqel | Satellite | |
| Macon, GA | Yahzeqel | Satellite | CoT Macon community |
| Manila, Philippines | Banayah | International | |
| Cebu, Philippines | Banayah | International | |
| Kumasi, Ghana | Izar | International | CoT Kumasi community |
| Accra, Ghana | Izar | International | School only — no City of Truth community |

## File Structure

```
True Nation Intranet Project Build/
├── CLAUDE.md                              ← You are here
│
├── embeds/                                ← All Google Sites HTML embed files
│   ├── home/                              ← home-announcements.html, home-quick-links.html
│   ├── dashboard/                         ← dashboard-identity, -quick-actions, -my-department, -events
│   ├── departments/
│   │   ├── departments-index-cards.html   ← Top-level all-depts index
│   │   ├── departments-bishops.html       ← Bishops branch overview
│   │   ├── departments-apostles.html      ← Apostles branch overview
│   │   ├── departments-deacons.html       ← Deacons branch overview
│   │   ├── departments-judges.html        ← Judges branch overview
│   │   ├── apostles/                      ← Disciples, Marketing, Performing Arts, Everyday Sheeple, Publications
│   │   │   ├── disciples-overview.html
│   │   │   ├── marketing-*.html
│   │   │   ├── performingarts-*.html
│   │   │   ├── everyday-sheeple-*.html    ← Everyday Sheeple dept + 8 sub-groups
│   │   │   └── publications-*.html
│   │   ├── deacons/                       ← CBD, Clerical, Custodial, Fellowship, Stewardship, Holistic Health, Maintenance, Safety & Facilities, Textiles
│   │   │   ├── cbd-*.html
│   │   │   ├── clerical-*.html
│   │   │   ├── custodial-*.html
│   │   │   ├── fellowship-*.html
│   │   │   ├── stewardship-*.html         ← Stewardship dept + 4 sub-groups (Bookkeeping, Fundraising, Travel, Tribal Exchange)
│   │   │   ├── health-*.html              ← Holistic Health dept (C.A.R.E., G.R.O.W.)
│   │   │   ├── maintenance-overview.html
│   │   │   ├── safety-facilities-*.html
│   │   │   ├── ert-overview.html
│   │   │   ├── security-overview.html
│   │   │   └── textiles-*.html
│   │   └── judges/                        ← Counseling (+ Sanhedrin), Ministries (+ SOV, Elders, Prayer, Prison)
│   │       ├── counseling-overview.html
│   │       ├── counseling-sanhedrin.html
│   │       ├── ministries-subgroup-cards.html
│   │       └── ministries-*.html
│   ├── people/                            ← our-people.html, people-directory, -by-campus, -by-dept, -profile-form
│   ├── tela/                              ← tela-overview/form/announcements/media/intramurals, tela-subgroup-cards, youth-*.html
│   ├── calendar/                          ← calendar-embed, -events, -upcoming, -past
│   ├── resources/                         ← library.html + library-*.html + resources-*.html
│   ├── locations/                         ← locations-cards.html
│   ├── leadership/                        ← leadership-hub, -bishops, -apostles, -deacons, -judges, -looker, -restricted
│   ├── it-logistics/                      ← it-*.html, logistics-*.html, paradox-app.html
│   └── shared/                            ← tnic-brand-styles.html, dept-subgroup-cards.html (template)
│
├── reference/                             ← Project docs, master reference files, org charts
│   ├── TNIC_All_Pages_Embeds.html         ← MASTER REFERENCE (source of truth for all embed code)
│   ├── TNIC_Department_Embeds.html        ← Department-only embed reference
│   ├── org-structure-current.html         ← Current org structure (visual reference)
│   ├── org-chart.html + org-chart-*.pdf  ← Org chart visual + 3 PDFs
│   ├── staff-directory-migration-guide.html
│   ├── operations-guide.html + .pdf
│   ├── visual-preview.html
│   ├── build-reference.xlsx
│   ├── master-plan.docx
│   ├── dashboard-prd.docx
│   ├── handoff-2026-03.docx               ← READ-ONLY reference
│   ├── remaining-work.docx
│   ├── admin-handoff.docx
│   ├── onboarding-qr.png
│   └── profile-setup.pptx
│
├── scripts/
│   └── staff-directory-sync.js            ← Apps Script for Workspace → Sheet sync
│
└── archive/                               ← All obsolete/old files (28 files)
```

## Remaining Work (Not Prioritized — Discuss with Shahad)

### Dashboard Build — COMPLETED ✓
Staff Data sheet extended, Apps Script sync running, AppSheet app built and embedded as My Dashboard page.

### Remaining Intranet Pages
- ~~17 remaining department pages~~ — COMPLETED ✓
- ~~Org structure rebuild from TN PORTAL Directory Sheets (May 2026)~~ — COMPLETED ✓
- **17 leadership bio cards** — `[REPLACE]` placeholders need real bio content
- **Campus location details** — Real addresses, service schedules, Google Maps embeds for 5 campuses
- **Google Calendar embed** — Connect real calendar feed
- ~~Footer year~~ — COMPLETED ✓ (updated to 2026)
- **T.E.L.A. sub-group leads** — Intramural Sports and program leads mostly filled; Performing Arts Dance TBD
- **`[Lead TBD]` placeholders** — Open leads: Marketing dept (`embeds/departments/apostles/marketing-subgroup-cards.html`), Performing Arts Dance (`performingarts-dance.html`), Safety & Facilities dept (`safety-facilities-subgroup-cards.html`), CBD ops deacon (`cbd-subgroup-cards.html`), Stewardship dept (`stewardship-subgroup-cards.html`), Custodial Cleaning crew (`custodial-cleaning.html`). Fill in as leads are confirmed.
- **Safety & Facilities dept page** — ✓ COMPLETED: `safety-facilities-subgroup-cards.html` created.
- **Holistic Health sub-group pages** — C.A.R.E. and G.R.O.W. With Us pages need to be created or updated.
- **SOV page** — ✓ COMPLETED: Updated to "Sisters of Virtue" everywhere.
- **Ministries sub-group pages** — ✓ COMPLETED: Sanhedrin moved to Counseling; `ministries-sanhedrin.html` renamed to `counseling-sanhedrin.html`.
- **Locations page** — Expand from 5 locations to 7 cities: Manila, Cebu, Kumasi, Accra (note Accra = school only, no CoT).
- **Master reference files** — `reference/TNIC_All_Pages_Embeds.html` and `reference/TNIC_Department_Embeds.html` need new textarea blocks + base64 previews added for the ~40 new/changed embeds from June 2026 rebuild.
- **Additional reference materials** — Brand assets, style guides, org chart data, and content copy may be added to this folder over time. Check for new files when starting a session.

## Key Conventions

1. Every embed includes the height-reporter `postMessage` script
2. Each embed's HTML comment header describes what it is, where to place it, and what `[REPLACE]` tags need updating
3. Card embeds use the `di-` class system with cream background wrappers
4. All text in headers/badges uses `text-transform: uppercase` and `letter-spacing`
5. Hover effects: gold border highlight + subtle lift (`translateY(-2px)`)
6. Mobile breakpoints: 2-column at 500px, stack to 1-column varies by embed
7. Google Fonts are imported per-embed (each embed is isolated in its own iframe)
