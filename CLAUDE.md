# True Nation Intranet — Claude Code Project Context

> **Read `portal-status.md` first.** It is the master handoff and the single source
> of truth for the live portal. This file covers *this folder* — what lives here,
> the brand tokens, and the org structure. Where the two disagree,
> `portal-status.md` wins.

## What this project is

A staff intranet for True Nation Israelite Congregation (TNIC), a multi-campus
religious organization.

**Google Sites is retired.** The intranet migrated to a Vercel Next.js app in
August 2026. Nothing new is built on Sites. The old Sites site is still intact
only as a DNS-level rollback path.

### The live architecture

- One Next.js app on Vercel serves two hostnames:
  - `portal.truenation.org` → the staff portal (`/portal/*`), gated by Google
    `@truenation.org` login via NextAuth.
  - `truenation.vercel.app` → the public onboarding form (Stage 1 account creation).
  - `app/page.js` is host-aware and routes by hostname.
- **Google Apps Script pages are standalone.** They open in a new tab as
  first-party Google pages and rely on the live Google session. They are never
  iframed, never embedded, never wrapped. Three deployments today: Main
  (directory / profile setup / Member Hub / Alms), Profile Editor, and the
  Teacher Portal (`moreh@` only).
- **Permissions are always by Google Group, never by individual.**

### Two repos — don't confuse them

| Repo | Local path | Contents |
|---|---|---|
| `shahad-tn/truenation` | `~/truenation-intranet-directory` | The Next.js portal + onboarding. Auto-deploys to Vercel on push to `main`. **Not in this folder.** |
| `shahad-tn/truenation-intranet` | `~/Documents/Claude/Projects/True Nation Intranet Project Build` | This folder: Apps Script sources, reference docs, legacy Sites embeds. |

## What lives in this folder

```
True Nation Intranet Project Build/
├── CLAUDE.md                  ← You are here
├── portal-status.md           ← MASTER HANDOFF — read first
│
├── scripts/                   ← Apps Script sources (source of record)
│   ├── directory/Code.gs      ← Staff directory + profile setup + Hub + Alms
│   ├── announcements/         ← Announcements portal page templates
│   ├── bible-basics-portal/   ← Teacher Portal (moreh@ gated)
│   ├── profile-editor.gs / profile-editor-ui.html
│   ├── quick-links.gs
│   └── staff-directory-sync.js  ← Daily Workspace → Sheet sync
│
├── reference/                 ← Project docs, org charts, guides
├── embeds/                    ← LEGACY Google Sites HTML embeds (see below)
└── archive/                   ← Obsolete files
```

### Apps Script deploy flow

Copy the whole file from the repo, paste over the matching file in the Apps
Script editor, save, then **Deploy → Manage deployments → pencil → Version: New
version → Deploy**. Never "New deployment" — that mints a new URL.

## Staff data sheet

Google Sheet `1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk` is the single source
of truth for member data. Tabs: **data** (active), **Former Staff** (archive —
anyone here is hidden), **Audit Log**, **Data Backup (pre-migration)**.

**Sheet writes:** always read the current header row first, add missing columns,
then write. Never hardcode column positions. Always the first sheet tab (index 0).

`scripts/staff-directory-sync.js` runs daily, filling `legal_first`, `legal_last`
and `phone` **only if blank**. It never overwrites hand-entered data.

## Brand design tokens

Updated 2026-08-29. Identity colours (Wine, Gold) unchanged; neutral surfaces
moved from warm to gray.

| Token | Hex | Usage |
|-------|-----|-------|
| Wine | `#7C1316` | Primary headers, links, CTAs |
| Gold | `#C9972C` | **Borders, rules, filled badges only — never text** |
| Gold (text on light) | `#785710` | Gold-coloured text on a light ground |
| Gold (text on wine) | `#D4A94D` | Gold-coloured text on wine (4.9:1) |
| Page | `#E8E8EC` | Page and section backgrounds |
| Surface | `#D8D8DE` | Subtle fills, table headers, badges |
| Card | `#FFFFFF` | Cards and panels sitting on Page |
| Line | `#BFBFC7` | Decorative borders and dividers |
| Line strong | `#86868F` | Borders of inputs and controls (WCAG 1.4.11 needs 3:1) |
| Ink | `#26262A` | Body text |
| Muted | `#56565E` | Secondary text |
| On wine | `#F2F2F3` | Any text on Wine or another dark ground |

**Correction on record:** the brand guide's claim that `#C9972C` on Warm Snow is
4.6:1 is wrong — the true value is **2.49:1**. Gold has never met WCAG AA as
text at any size. It is a fill and border colour, with the two dedicated text
variants above.

**Why the surfaces are gray:** Warm Snow page + Warm Cream panels + white cards
left roughly a 2% luminance step between adjacent surfaces. Edges were hard to
locate and the page read as one flat warm field. The gray scale keeps the same
structure with real separation.

**Non-negotiable:** never pure black or pure white for text; never a serif font;
gold never carries body text; only `#F2F2F3` on dark grounds. Everything WCAG AA.

**Typography:** Barlow Condensed (600/700) for headings, uppercase with
letter-spacing. DM Sans (400/500/700) for body.

```
https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap
```

**Contact:** member-facing contact is always `it@truenation.org`, never
`tn-admin@`. Admin group: `tn-admin@truenation.org`. Domain: `truenation.org`.

**Logo:** always the official `tn_logo.png` / `TN_Logo_BIG.png` — never recreate it.

## Organization structure

**5 Branches** (governance hierarchy, NOT geographic): Bishops > Apostles >
Deacons > Judges > Congregants. **Council** is a separate governance body
(Bishops + Apostles together) — it is not a branch.

> **Personnel: `portal-status.md` is authoritative and supersedes the roster
> below.** On record there: **Kabash, Kanash and Yashan have left** the
> congregation and are removed from the portal everywhere. Current deacons:
> **Kahan, Ahman, Rakab, Shamar, Raiyah, Shahad.** Departments whose lead was
> one of the departed now show "To be announced": Clerical, Performing Arts,
> Holistic Health & Healing, Textiles & Attire, Everyday Sheeple. Fellowship &
> Service → Deacon Kahan. Any lead name below that contradicts this paragraph is
> stale — do not carry it into new work.

### Bishops (4)
- Bishop Tazayawan — Los Angeles, CA (HQ) · Youth Director (T.E.L.A.) · CBD overseer
- Bishop Yahzeqel — Detroit, MI & Macon, GA (Satellite) · CoT Macon overseer
- Bishop Banayah — Manila & Cebu, Philippines · Ministries lead · Tribal Exchange oversight
- Bishop Izar — Kumasi & Accra, Ghana (Accra = school only, no CoT) · Maintenance overseer

### Apostles Branch (Doctrine)
Apostles: Ash Napash, Yashami. 6 departments:
- **Disciples** — leads Ash Napash, Yashami. No sub-groups.
- **Marketing** — lead TBD. Sub-groups: Graphic Design (Ratazah), Social Media (Yaqataza).
- **Performing Arts** (moved from Deacons) — lead to be announced. Programs: Acting
  (Tazayawan), Dance (TBD), Music, Poetry. Music is only a Performing Arts program.
- **Everyday Sheeple** (formerly Production) — lead to be announced. Sub-groups (8):
  Sound (Yashami), Videography, Photography (Yaqataza), Camera & Lights, A/V (Shamar),
  Stage Production (Ahman), Visual Art (Ahmaryah/Karamyah), PARADOX (Tazayawan — the
  media ministry; the PARADOX *App* is IT/Applications, not here).
- **Publication** — lead Shamar. Sub-groups: Newsletter, Quarterly Brew.
- **T.E.L.A.** (formerly Youth Development) — Youth Director Bishop Tazayawan.
  Programs (6): Intramural Sports, Jr. Disciples (Ash Napash), Little Lions,
  Maiden Ewe's (Shawashan), Naqam Freshman, Naqam Varsity. Youth Council is a
  separate governing body (not the Judges Council). **Cross-functional model:**
  TELA support roles are joint appointments from parent departments — no parallel
  titles. Ashley (Events & Activities Coordinator) is TELA-specific.

### Deacons Branch (Administration & Resources)
10 departments: **CBD, Clerical, Custodial, Fellowship & Service, Stewardship,
Holistic Health & Healing, IT, Maintenance, Safety & Facilities, Textiles &
Attire.** (Performing Arts moved to Apostles; E.R.T. and Security consolidated
under Safety & Facilities.)
- **CBD** (Community Building) — overseer Bishop Tazayawan; ops lead TBD.
  Sub-groups: Camp Tazarah (Ash Napash), CoT Kumasi (Izar), CoT Macon (Yahzeqel).
- **Clerical** — lead to be announced. Sub-groups: Administration Committee (Sarah),
  Logistics (Shawashan).
- **Custodial** — lead Kawan. Sub-groups: Cleaning Crew, Detailing (Lawah).
- **Fellowship & Service** — lead Deacon Kahan. Sub-groups: Fellowship (Mathathyah,
  org-wide incl. TELA), Hospitality (Shawashan), Feast Committee → Beverages,
  Ceremonial (TBD), Culinary, Decor (Adah), Desserts (Shalawa), Sacrificial Cooking
  (Kahan), Serving & Catering (Lawah).
- **Stewardship** (formerly Finance) — lead TBD. Sub-groups: Bookkeeping (Marayam),
  Fundraising (Ahhabyah), Travel (Shabayah), Tribal Exchange / Marketplace (Banayah).
- **Holistic Health & Healing** — lead to be announced. Sub-groups: C.A.R.E.
  (Committed to Aid, Restore & Encourage — lead Qawalyah; org-wide incl. TELA),
  G.R.O.W. With Us (Bayanah).
- **IT** — lead Shahad (asst Sarah, Yedayah). Sub-groups: Infrastructure, Website,
  Applications (includes the PARADOX App platform).
- **Maintenance** — ops lead Rakab; overseer Bishop Izar. No sub-groups.
- **Safety & Facilities** — lead TBD. Sub-groups: E.R.T. (lead Shamar; members
  Shamar, Malaakaya), Security (lead Ahman, asst Chaanak).
- **Textiles & Attire** — lead to be announced. Sub-groups: Apparel (asst Karamyah),
  Faithful Seams, Uniform (Qawalyah).

### Judges Branch (Righteousness)
Council: Tazayawan, Banayah, Izar, Yahzeqel, Ash Napash, Yashami.
- **Counseling** — lead Tazayawan; coordinator Yashami. Sub-group: Sanhedrin
  (Calendar Committee).
- **Ministries** — lead Bishop Banayah. Sub-groups: Elders Ministry, Prayer
  Ministry, Prison Ministry, SOV — Sisters of Virtue (Marayam). "Ministries" as a
  Judges department name is official and stays; the old generic "Ministries"
  umbrella label was replaced with "Departments" everywhere else.

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

## Working conventions

- **Git:** Claude edits files. **Shahad runs every git command himself** and pushes.
  Claude hands him the bash block; Claude does not execute git.
- **No `#` comment lines inside bash blocks** — his zsh has `interactive_comments`
  off, so a comment line executes as a command and breaks the paste.
- **Paths:** always give macOS paths, never the bridge's `$HOME/mnt/...` spelling.
- **Confirm before building.** Move one step at a time and ask rather than guess.
- **Apps Script private functions:** only a **trailing** underscore hides a function
  from `google.script.run`. A leading underscore does nothing — a leading-underscore
  "private" helper is callable from any member's browser console.
- **Email subjects:** plain hyphens only — em dashes cause mojibake.
- **In-app links (GAS pages):** build every link from `appUrl_()`
  (`ScriptApp.getService().getUrl()`) and read query params from `params` in the
  server template — never from `window.location`. These pages render inside a
  `googleusercontent.com` sandbox frame whose URL carries no query string, so
  relative hrefs and `window.location.search` both silently fail.

## Legacy — Google Sites embeds

`embeds/` and `reference/TNIC_All_Pages_Embeds.html` are the Sites-era artifacts.
They are kept for reference and content salvage. **Do not build new work on them.**

If a change to an embed is ever explicitly asked for, the master reference
`reference/TNIC_All_Pages_Embeds.html` is the source of truth: update both the
standalone file in `embeds/` and the corresponding HTML-escaped textarea block in
the master reference. `reference/handoff-2026-03.docx` is read-only.

The `tnic-height` `postMessage` height reporter and `<base target="_top">` found
in these files are Google Sites iframe machinery and are dead code anywhere else.
