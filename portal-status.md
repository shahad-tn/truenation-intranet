# True Nation Portal — Master Handoff (Resume Here)

**Status: LIVE.** `portal.truenation.org` now serves the Vercel Next.js portal (not
Google Sites). The DNS cutover is complete. This doc is the single source of truth for
a new chat — read it first.

Repo: `github.com/shahad-tn/truenation` · local `~/truenation-intranet-directory`
Production branch: **`main`** (auto-deploys to Vercel on push). The old
`feat/portal-auth` branch was merged into `main` at go-live.

---

## What this project is

A staff intranet for True Nation Israelite Congregation, migrated from Google Sites to
a Vercel Next.js app, gated by Google (@truenation.org) login. One Next.js app serves
two hostnames:
- `portal.truenation.org` → the **staff portal** (`/portal/*`, login-gated).
- `truenation.vercel.app` → the **public onboarding** form (Stage 1 account creation).

The root route `app/page.js` is **host-aware**: `portal.truenation.org` → `/portal`;
anything else (the vercel.app domain) → `/onboarding`.

---

## Go-live / cutover — DONE (2026-08). How it was wired, for reference & rollback

- **DNS (Squarespace):** `portal` CNAME now points to the Vercel target
  `0bf8d42f92a50103.vercel-dns-017.com` (was `ghs.googlehosted.com` for Google Sites).
  A host allows only one CNAME — the record was **replaced**, not added.
  **Rollback = point that CNAME back to `ghs.googlehosted.com`.** The Google Sites site
  itself was left intact, so rollback is a one-record DNS change.
- **Vercel:** `portal.truenation.org` added as a domain (shows "Valid Configuration");
  Vercel auto-issued the TLS cert.
- **Auth config that MUST stay in place** (sign-in breaks without any of these):
  - Env var **NAMES matter** — the code reads `GOOGLE_OAUTH_CLIENT_ID` /
    `GOOGLE_OAUTH_CLIENT_SECRET` (with the `_OAUTH_` middle), **not** `GOOGLE_CLIENT_ID`.
    A name mismatch here caused a `client_id is required` failure during cutover.
  - `NEXTAUTH_URL = https://portal.truenation.org` (Production).
  - `NEXTAUTH_SECRET` set to a real value (a stale/empty one caused a sign-in→loop).
  - `GOOGLE_SERVICE_ACCOUNT_BASE64` + `GOOGLE_ADMIN_EMAIL` (used by the directory/
    moreh-group lookup at sign-in and by onboarding).
  - All the above scoped to **Production, Preview, and Development**. **Env-var changes
    require a redeploy** — they don't apply to an already-built deployment.
  - Google Cloud OAuth client `16223018473-ml9h3b8badenftsan90pp5htidlt4c8c.apps.googleusercontent.com`
    has authorized redirect URI `https://portal.truenation.org/api/auth/callback/google`
    (must be on **that exact client** — the one `GOOGLE_OAUTH_CLIENT_ID` points to).

---

## Google Apps Script (GAS) — the three deployments

The GAS side (`Code.gs`, `userdirectory.html`, `profilesetup*.html`, `Hub.html`,
`Alms.html`) is maintained in this Project but deployed separately in Apps Script.

| Purpose | Exec URL (prefix) | How it's reached |
|---|---|---|
| **Main** — directory (Our People), profile setup, Member Hub, Alms | `…/s/AKfycbxrRxV7RHgt9m7F…/exec` | bare = directory; `?page=profilesetup`, `?page=hub`, `?page=alms` |
| **Profile editor** (self-service) | `…/s/AKfycbzvYnsSNAUz…/exec` | linked from My Dashboard |
| **Teacher Portal** (moreh@ only) | `…/s/AKfycbz5VcMauDkek…/exec` | Dashboard + `/portal/teachers` |

`Code.gs` `doGet(e)` routes by `?page=`: `alms` → `Alms.html`, `hub` → `Hub.html`,
`profilesetup` → mobile/desktop profile form, default → `userdirectory.html`.
`saveAlmsCommitment(payload)` and `saveProfile(data)` write to the member's row in the
shared staff Sheet (`SHEET_ID` in Code.gs).

---

## Portal — current structure & recent changes

### Type scale (the one lever)
`app/portal/layout.js` injects `<style>:root{font-size:117.5%}</style>`. Because every
portal size is `rem`-based, **this single value scales the whole portal**. Scoped to
portal routes only (this layout wraps `/portal/*`), so onboarding is unaffected.
Effective body text ≈ **17px** (slightly above the 16px web standard). **Decision: leave
as-is** — the "small" perception came mostly from the condensed Barlow font and muted
secondary color, not the size. To resize everything later, change only this %.

### Header / nav (`layout.js`, `PortalNav.js`, `portal.module.css`)
- Nav bar is full-bleed; its **content is capped to a 1080px centered column**
  (`.navInner`) so it lines up with the page content's left/right edges.
- **Signed-in email** shows top-right, grouped with the **Sign out** button
  (`.userBox` / `.userEmail`; email hides on ≤860px). It was moved here from the footer.
- Nav items: **Home, My Dashboard, Member's Hub, Departments, Our People, Resources,
  Leadership, Locations, Calendar.** (T.E.L.A. and Profile Setup were removed from the
  bar — T.E.L.A. still exists as a page and in home Quick Links.)
- Theme toggle: site-wide light/dark (`ThemeToggle.js`), sets `data-theme` on `<html>`,
  persists `localStorage['tn-theme']`; no-flash inline script in layout.

### Footer (`PortalFooter.js`, footer CSS in `portal.module.css`)
Single fixed **wine tier** (the old black bottom tier was removed; no logo — it was
skewed). Four columns: **Brand** (name, "Awaken · Restore · Unite", "More than a body —
we're a family.", and a `truenation.org` link) → **Quick Links** (Our People, Department
Pages, Congregation News) → **Give Alms · $150** (Zeffy `truenation.org/alms`, Zelle,
Envelope) → **Connect** (reachus@truenation.org + FB/IG/YT social icons, 28px glyphs in
46px buttons). Bottom bar: copyright only (signed-in email now lives in the header).
Real socials: FB `/TrueNationIsraeliteCongregation`, IG `/truenationlosangeles`,
YT `/truenationlosangeles`. Member-facing contact is always `it@truenation.org`, never
`tn-admin@`.

### Pages
- **Home** (`portal/page.js` + `home.module.css`): wine banner hero, Announcements above
  Quick Links, real hyperlinks, "Intranet" wording, Member's Hub first in Quick Links.
- **My Dashboard** (`dashboard/page.js`, `lib/staff.js`): staff name on the greeting line;
  links to Profile Editor + (moreh@) Teacher Portal.
- **Departments**: landing (`departments/page.js`) with shared `departments/data.js`;
  per-dept dynamic route `departments/[slug]/page.js` (17 slugs, `dynamicParams=false`);
  Bishop pages `departments/bishops/[slug]/page.js` (tazayawan, yahzeqel, banayah, izar)
  with **placeholder photo + bio fields** to fill in. Branch heading: label with the
  **description stacked under it** on the left, gold divider beneath.
- **Leadership Hub** (`leadership/page.js`): Bishop Council, Apostles, Deacons, Judges,
  Restricted (Phase-3 locked previews). Cards now **bottom-align** the location/Contact/
  divider block (`margin-top:auto`) so they line up regardless of pill count.
- **Member's Hub** (`resources/hub/page.js` + `hub.module.css`): white content cards,
  TN logo above "Shalom", reformatted General Remarks. **Alms Commitment** button →
  standalone Apps Script page `…/AKfycbxrRxV7RHgt9m7F…/exec?page=alms` (new tab,
  first-party, needs live Google session). The old Google Sites alms link is gone, and
  the **native `/portal/resources/hub/alms` page + `app/api/alms/route.js` were deleted**
  (superseded by the GAS page).
- **Resources**: landing + 4 category pages (shared `ResourceList.js` + `data.js`).
- **T.E.L.A.**: `/portal/tela` landing + `tela/[slug]` youth sub-pages (5).
- **Locations**: `/portal/locations` (5 campus cards).
- **Calendar**: `/portal/calendar` (Weekly Rhythm + Google Calendar embed placeholder).

---

## Personnel (authoritative — supersedes any desktop org doc)
- LEFT the congregation (removed from the portal everywhere): **Kabash, Kanash, Yashan.**
- Deacons roster: **Kahan, Ahman, Rakab, Shamar, Raiyah, Shahad.**
- Vacated department leads show "To be announced": Clerical, Performing Arts, Holistic
  Health & Healing, Textiles & Attire, Everyday Sheeple. Fellowship & Service → Deacon Kahan.

---

## Open TODOs / deferred
- **Favicon (queued):** add the True Nation logo as the site icon — bundle into the next
  code change. (Next.js App Router: `app/icon.png`, or `metadata.icons` in the root
  `app/layout.js` pointing at `/tn_logo.png`.)
- **Live data (future):** leadership + department rosters and bishop photos/bios are
  hardcoded arrays (`leadership/page.js`, `departments/[slug]/page.js`,
  `departments/bishops/[slug]/page.js`, `departments/data.js`). Eventually pull from the
  live member-profile data (the staff Sheet the GAS forms populate) via a `lib/staff.js`-
  style read or an API route.
- Fill placeholder data as it arrives: Resources Drive links; dept + youth chat/drive
  links; Locations addresses/schedules/map srcs; Calendar `CALENDAR_SRC`; real leadership
  emails/bios; bishop photos + bios; new leads for "To be announced".
- Post-cutover nicety: add the portal header bar to the GAS "Our People" directory
  (`userdirectory.html`) so it matches the portal chrome.
- Rate-limit the public `/api/onboard` route.

---

## Working conventions (how to make changes)
- **Brand (surfaces updated 2026-08-29 — warm neutrals replaced by gray):** Dark Wine
  `#7C1316` (headers/nav/buttons), wine-deep `#5E0E11`/`#3D0A0C`, Sovereign Gold `#C9972C`
  (**borders and fills only — never text**; as text it is 2.2:1 and fails AA. Use
  `#785710` on light, `#D4A94D` on wine). Page `#E8E8EC` (was Warm Snow `#FAF8F4`),
  Surface `#D8D8DE` (was Warm Cream `#F2EDE4`), Card `#FFFFFF`, Line `#BFBFC7`,
  control borders `#767680` (the guide's `#86868F` is only 2.95:1 on the page
  ground and fails WCAG 1.4.11 there - see `reference/standalone-apps-check.md`),
  body text `#26262A` (was `#130D0A`), muted `#56565E`,
  text on dark `#F2F2F3`. Never pure black/white; **sans-serif only** (Barlow Condensed
  display, DM Sans body). Fixed dark panels (nav/footer/hero) use literal hex plus
  `#F2F2F3` because `--wine`/`--cream` both resolve to the light value in dark mode.
- **Theming:** design tokens live on `.shell` in `portal.module.css`; new `.shell` pages
  follow light/dark automatically. Everything WCAG AA; verify contrast on fixed chips.
- **Workflow:** Claude edits files in the cloud sandbox → delivers via SendUserFile →
  writes back into the repo through the desktop **device bridge** → **USER runs all git**
  (sandbox git leaves lock cruft) and pushes to `main`. Don't run
  `npm audit fix --force`.
- **Verify before commit (static):** esbuild JSX parse, CSS brace balance, and
  styles.X→CSS class-ref checks. The authoritative build test is the Vercel deploy.
- **Device access:** connected folders are `~/truenation-intranet-directory/app` and
  `/lib`. The rest of the repo root (e.g. `middleware.js`) is outside the connected
  folders. If the desktop sign-in goes stale, staging is denied ("untrusted device") —
  the user re-signs-in the Claude desktop app, then it works.
- Don't paste rendered Google Sites HTML — it's noise; the clean source embeds / current
  code are the inputs to build from.

---

## Standard deploy step (what the user runs after Claude writes files)
```bash
git add -A app          # -A also catches deletions/renames
git commit -m "…"
git push origin main    # production; Vercel builds on push
```
