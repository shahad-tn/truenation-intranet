# True Nation Intranet — Detailed Handoff Reference

**Date:** April 1, 2026
**Handoff From:** Claude (Cowork mode) → Claude Code
**Project Owner:** Shahad (IT Department Lead, True Nation Community)

---

## 1. Project Summary

True Nation Israelite Congregation (TNIC) is building a Google Sites intranet for their multi-campus religious organization. The intranet serves as an announcements hub, staff directory, document library, and coordination platform.

The site is built on Google Sites free tier, enhanced with custom HTML embeds pasted via Insert → Embed → Embed Code. Each embed is a self-contained HTML file with its own styles, fonts, and a height-reporter script. The master reference file (`TNIC_All_Pages_Embeds.html`) aggregates all embeds with copy buttons and live previews.

**Platform stack:** Google Sites + AppSheet (directory) + Looker Studio (dashboards) + Apps Script (automation) + Google Forms (input) + Custom HTML/CSS embeds.

---

## 2. Critical Workflow Rules

### 2.1 Master Reference is the Source of Truth
All embed changes must be made in `TNIC_All_Pages_Embeds.html`. When editing an embed:
1. Edit the standalone file in `Week1_Deliverables/`
2. Update the corresponding `<textarea>` in `TNIC_All_Pages_Embeds.html` with HTML-escaped content
3. Update the base64-encoded preview iframe to match
4. **Never** modify `TNIC_Handoff_2026-03.docx` unless Shahad explicitly asks

### 2.2 How to Update a Textarea Block
The textarea content must be HTML-escaped. Use Python's `html.escape()` or equivalent. The preview iframe uses base64-encoded raw HTML via `data:text/html;base64,`. When updating:
- Escape the raw HTML for the textarea: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`, `"` → `&quot;`, `'` → `&#x27;`
- Base64-encode the raw (unescaped) HTML for the preview iframe
- Be extremely careful with the textarea boundaries — the opening `<textarea ...>` and closing `</textarea>` tags must remain intact

### 2.3 Additional Reference Files
Shahad will be adding brand assets, style guide materials, org chart data, and content copy to the project folder over time. Check for new files at the start of each session.

---

## 3. Organization Structure

### Governance Hierarchy (5 Branches)
Bishop → Apostle → Deacon → Judge → Congregant

**Council** = Bishops + Apostles together as a governance body. Council is NOT a branch.

### Bishops (4 total)
| Bishop | Campus | Type | Notes |
|--------|--------|------|-------|
| Tazayawan | Los Angeles, CA | HQ | Primary leader |
| Yahzeqel | Detroit, MI & Macon, GA | Satellite | Two campuses |
| Banayah | Philippines | International | HQ liaison for comms, NOT Bishop OF Philippines |
| Izar | Ghana | International | HQ liaison for comms, NOT Bishop OF Ghana. Also Maintenance dept lead |

### Apostles Branch (Doctrine — Teaching, Education, Research)
**Apostles:** Ash, Yashami

| Department | Lead | Sub-groups |
|-----------|------|------------|
| T.E.L.A. | Bishop Tazayawan | Intramural Sports, Jr. Disciples, Little Lions, Maiden Ewe's, Naqam Freshman, Naqam Varsity |
| Disciples Program | Ash Napash / Yashami | — |
| Production | — | Sound (Apostle Yashami), Videography (Ahch Yashan), Photography (Ahch Yaqataza), Camera & Lights (Yashan), A/V Audio/Visual (Deacon Shamar), Stage Production (Deacon Ahman), Marketing, Graphic Design (Ahwath Ratazah) |
| PARADOX | Bishop Tazayawan | Everyday Sheeple, PARADOX App |

### Deacons Branch (Administration & Resources)
**Deacons:** Kahan, Kabash, Kanash, Ahman, Rakab (unassigned dept), Shamar

| Department | Lead | Sub-groups |
|-----------|------|------------|
| Clerical | Deacon Kabash | Administration Committee |
| E.R.T. | Deacons Kanash/Shamar | — |
| CBD — Community Building | Bishop Tazayawan | Camp Tazarah, City of Truth Ghana, City of Truth Macon |
| Custodial | Kawan | Cleaning Crew, Detailing |
| Fellowship & Services | Deacons Kabash/Kahan | Feast Committee (7 sub-units), Hospitality |
| Holistic Health & Healing | Deacon Kanash | G.R.O.W. With Us |
| Finance | — | Fundraising, Travel Committee, Tribal Exchange, Bookkeeping |
| IT / Information Technology | Shahad | Logistics, Infrastructure, Website |
| Maintenance | Bishop Izar | — |
| Performing Arts | Deacon Kabash | Music |
| Publications | Deacon Shamar | Newsletter, Quarterly Brew |
| Security | Deacon Ahman | — |
| Textiles & Attire | Deacon Kanash | Apparel, Faithful Seams, Uniform |

### Judges Branch (Righteousness)
**Council Members:** Tazayawan, Banayah, Izar, Ash, Yashami

| Department | Lead | Sub-groups |
|-----------|------|------------|
| Counseling | Bishop Tazayawan | Coordinator, Sanhedrin/Calendar Committee |
| Ministries | Bishop Banayah | Elders Ministry, Prayer Ministry, Prison Ministry, SOV |

**Terminology note:** "Ministries" here is the official Judges Branch department name. The old generic "Ministries" umbrella was replaced with "Departments" across the intranet.

---

## 4. Brand Design System

### Color Tokens
| Token | Hex | Usage |
|-------|-----|-------|
| Wine | `#7C1316` | Primary: headers, links, CTAs, card names |
| Gold | `#C9972C` | Accent: labels, lead tags, borders, arrows, hover borders |
| Snow | `#FAF8F4` | Backgrounds: page bg, section wrappers |
| Cream | `#F2EDE4` | Subtle: card borders, dividers, badge bg |
| Bark | `#3D2E28` | Body text |
| Ink | `#130D0A` | Dark text, card base color |
| Muted | `#9a8e87` | Meta text, labels, counts |

### Typography
- **Headings:** Barlow Condensed, weight 600-700, uppercase, letter-spacing 0.03-0.08em
- **Body:** DM Sans, weight 400-700
- **Font import:** `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap`

### Badge Color System
| Badge Class | Branch | Background | Text Color |
|------------|--------|------------|------------|
| `.badge-bi` | Bishops | `#2A1214` | `#F2EDE4` |
| `.badge-ap` | Apostles | `#F0E6D0` | `#8B6914` |
| `.badge-de` | Deacons | `#F0D8D8` | `#7C1316` |
| `.badge-ju` | Judges | `#D8DFF0` | `#2E4A6B` |

### Card Design Pattern
Every department/branch card follows the same structure:
```
Badge (pill) → Name (wine, uppercase) → Lead info (gold label + bark text) → Arrow (gold →)
```
Cards are `<a>` tags with: white background, cream border, 8px radius, 18px/16px/14px padding, hover = gold border + 2px lift + shadow.

---

## 5. CSS Class Prefix Guide

| Prefix | Scope | Used In |
|--------|-------|---------|
| `di-` | Department index/branch cards | `departments-index-cards.html`, all `departments-*.html` branch embeds |
| `tnic-` | Department detail embeds | Individual dept pages, subgroup cards |
| `ql-` | Quick links grid | `home-quick-links.html` |
| `ann-` | Announcements | `home-announcements.html` |
| `hero-` | Home banner | `home-banner.html` (in master reference) |

---

## 6. Embed Inventory by Page

### Home (3 embeds)
| ID | File | Description |
|----|------|-------------|
| `home_banner` | home-banner.html | Wine hero banner with tagline |
| `home_quicklinks` | home-quick-links.html | 8 navigation tiles |
| `home_announcements` | home-announcements.html | Scrollable announcement cards |

### Our People (5 embeds)
| ID | File | Description |
|----|------|-------------|
| `our_people` | our-people.html | Overview with feature tiles |
| `people_directory` | people-directory.html | Staff directory (links to AppSheet) |
| `people_by_campus` | people-by-campus.html | Browse by campus tiles |
| `people_by_dept` | people-by-dept.html | Browse by department tiles |
| `people_profile_form` | people-profile-form.html | Profile update form placeholder |

### Departments (6 embeds)
| ID | File | Description |
|----|------|-------------|
| `departments_index_cards` | departments-index-cards.html | All-departments index grid (5 branches) |
| `departments_bishops` | departments-bishops.html | 4 bishop cards (di- class system) |
| `departments_deacons` | departments-deacons.html | Deacons branch section |
| `departments_apostles` | departments-apostles.html | Apostles branch section |
| `departments_judges` | departments-judges.html | Judges branch section |
| + department detail embeds | Various | Individual dept landing pages |

### T.E.L.A. (6 embeds)
`tela-overview`, `tela-subgroup-cards`, `tela-intramurals`, `tela-media`, `tela-form`, `tela-announcements`

### Calendar & Events (4 embeds)
`calendar-events`, `calendar-embed`, `calendar-upcoming`, `calendar-past`

### Resources / Library (9 embeds)
`library`, `resources-study`, `resources-media`, `resources-policies`, `resources-forms`, `library-study`, `library-media`, `library-policies`, `library-forms`

### Locations (1 embed)
`locations-cards` — Campus location cards (needs real addresses, maps, schedules)

### Leadership (7 embeds)
`leadership-hub`, `leadership-bishops`, `leadership-apostles`, `leadership-deacons`, `leadership-judges`, `leadership-looker`, `leadership-restricted`

### IT / Logistics (7 embeds)
`it-infrastructure`, `it-website`, `logistics-subgroup`, `logistics-assignments`, `logistics-equipment-status`, `logistics-request-tracker`, `logistics-vendor-reference`

### Sub-Group Sections (17 embeds across Finance, Fellowship, Performing Arts, Production, Publications, Textiles, Other)

---

## 7. Remaining Work Items

These are not prioritized — discuss order with Shahad:

### Content Gaps (HIGH)
- 17 department landing pages need to be built or completed
- 17 leadership bio cards have `[REPLACE]` placeholder content
- Campus locations need real addresses, service schedules, and Google Maps embeds
- T.E.L.A. sub-group lead names need to be filled in
- Deacon Rakab needs a department assignment

### Technical (MEDIUM)
- Connect real Google Calendar embed feed
- Build remaining department page embeds that don't exist yet
- Fill all `[REPLACE]` href links throughout embeds with actual Google Sites page URLs

### Polish (LOW)
- Footer year: 2025 → 2026
- Verify all embeds in master reference have matching standalone files in Week1_Deliverables/
- Mobile QA pass across all embeds

---

## 8. Build Roadmap (Original Plan)

- **Phase 1 (Weeks 1-4):** ESSENTIALS — Home page, Staff Directory (AppSheet), Department pages (HQ)
- **Phase 2 (Weeks 5-8):** EXPANSION — T.E.L.A., Calendar & Events, Resources Library
- **Phase 3 (Weeks 9-12):** ADVANCED — Leadership Hub, Automation (Apps Script), Looker Studio dashboards
- **Phase 4 (Weeks 13-16):** LOCATIONS + LAUNCH — Satellite location pages, Mobile QA, Full launch

---

## 9. Access & Integrations

- **Access Control:** Google Groups — `tn-all@`, `tn-leadership@`, `tn-admin@`, `tn-hq@`, `tn-finance@`, `tn-it@`, `tn-tela@`, `tn-tela-admin@`, `tn-moreh@`
- **103+ Google Chat Spaces** linked from department pages
- **Three-layer comms model:** Sites = reference/read, Google Chat = real-time communication, Google Forms = structured input

---

## 10. Key Files Quick Reference

| File | Purpose | Editable? |
|------|---------|-----------|
| `TNIC_All_Pages_Embeds.html` | Master reference with all embeds | **YES — primary working file** |
| `TNIC_Department_Embeds.html` | Department-only reference (19 depts) | Yes |
| `TNIC_Handoff_2026-03.docx` | Handoff document | **READ ONLY** |
| `TNIC_Intranet_Build_Reference.xlsx` | Build reference spreadsheet | Reference |
| `TrueNation_Intranet_Master_Plan.docx` | Project plan | Reference |
| `Week1_Deliverables/*.html` | Standalone embed files | Yes — keep in sync with master |
| `tnic-brand-styles.html` | Global brand stylesheet embed | Yes |

---

## 11. Pattern: Creating a New Embed

When building a new embed from scratch:

1. Create the standalone HTML file in `Week1_Deliverables/`
2. Include the comment header block describing purpose, placement, and `[REPLACE]` tags
3. Import Google Fonts within the embed
4. Use the appropriate CSS class prefix for the section type
5. Add the height-reporter `postMessage` script at the bottom
6. HTML-escape the content and add it as a new `<textarea>` block in `TNIC_All_Pages_Embeds.html`
7. Base64-encode the raw HTML for the preview iframe
8. Place it in the correct page-section of the master reference

### Embed Template
```html
<!--
  TRUE NATION INTRANET — [SECTION NAME]
  ──────────────────────────────────────
  Embed via Insert → Embed → Embed Code in Google Sites.
  Place [WHERE TO PLACE].

  [REPLACE] [what needs to be replaced]
-->
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">

<style>
  /* Styles scoped to this embed */
</style>

<div class="[prefix]-wrap">
  <!-- Content -->
</div>

<script>
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
</script>
```
