# True Nation — System Map

**The one document to read first.** Every deployed thing, where its source lives, and how
to reach it. Written 2026-09-15. Nothing else in this project records the scriptIds — they
previously existed only inside `_clasp-pull/*/.clasp.json`, which is now archived.

---

## 1. Apps Script projects (5)

There are **five**: four web apps plus the groups + members library. (Older docs said
"three"; they predated the announcements portal and the library. Corrected 2026-09-16.)

### 1.1 Operations / Directory — the main web app

| | |
|---|---|
| **scriptId** | `15p_Tu-W2PTzp0iep9UHaNeXmle0X4mhFAqfqFBl2Y8U8U_5odNrYLFax` |
| **Deployment** | `https://script.google.com/a/macros/truenation.org/s/AKfycbxrRxV7RHgt9m7F-y7nV9pptxf8eEvSsSEoNd45pV8zTD-ZNettg0-ZsDCZQK8YgmDO/exec` |
| **Source** | `scripts/directory/` |
| **Access** | `DOMAIN`, `executeAs: USER_DEPLOYING` |
| **Size** | `Code.gs` 75 KB / 57 functions · `userdirectory.html` 160 KB · `Hub.html` 86 KB |

Routes by `?page=`:

| Query | Serves | File |
|---|---|---|
| *(none)* | Staff directory — "Our People" | `userdirectory.html` |
| `?page=profilesetup` | 8-step profile form (router picks mobile/desktop) | `profilesetup_router.html` → `profilesetup.html` / `profilesetup_desktop.html` |
| `?page=hub` | Member's Hub | `Hub.html` |
| `?page=alms` | Alms Commitment | `Alms.html` |

Config (`Code.gs` lines 17–21): `SHEET_ID 1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk` ·
`DRIVE_FOLDER_ID 1oXTjNqtgenlOgA8t1t_y2365aDaEJsRG` · `DOMAIN truenation.org` ·
`ADMIN_GROUP tn-admin@truenation.org`.

Also in this folder but belonging to **other efforts**: `ride_for_my_brews.gs`,
`tela_soccer.gs`, `Passover Garments Monday Reminder.gs`, `quick-links.gs`.

13 OAuth scopes incl. `admin.directory.user`, `spreadsheets`, `drive`, `gmail.send`,
`contacts`, `script.external_request`, `script.scriptapp`. Advanced service: `AdminDirectory`.
**No Calendar scope.**

### 1.2 Teacher Portal

| | |
|---|---|
| **scriptId** | `1IXpetrVjjJ3E0LN93LuaFw-9yqBnlequeHbt5LNkEhyv1zcUdcOYvYjI` |
| **Deployment** | `https://script.google.com/a/macros/truenation.org/s/AKfycbz5VcMauDkekIwESjo2UAvlvHjPLDE3jHRTSCUer8NYQI0qyYx5z4OF10_BmrsyilhC/exec` |
| **Source** | `scripts/teachers portal/` (note: **lowercase** `code.gs`) |
| **Access** | `DOMAIN`, `executeAs: USER_DEPLOYING` |
| **Gating** | `moreh@truenation.org`; admins `tn-admin@`, `apostles@`, `bishops@` |

`?view=public` → `public.html` · in `moreh@` → `index.html` · else `denied.html`.

**Correction (2026-09-15):** `?view=public` means *no `moreh@` check* — it is **not anonymous**. The manifest sets `"access": "DOMAIN"`, so every route still requires a signed-in `truenation.org` account. Verified: an unauthenticated browser is redirected to `accounts.google.com`. If a genuinely public class schedule is wanted, that is the public **Classes calendar**, not this route.

Sheet `1fmbURWbBGIFbWiUZubpY4_KR7RhnCZUGLZOsGHytoV0`, tabs `bible_basics_topics`,
`world_history_topics`, `class_config`, overrides. `WEEKS_AHEAD = 16`.

**Its manifest declares no `oauthScopes` at all** — it relies on auto-scoping. Adding
CalendarApp will need either an explicit block or a re-authorisation.

**2026-09-15 - FIXED AND DEPLOYED.** All 31 private helpers renamed from `_foo` to `foo_`.
Verified: repo shows 17 exposed / 31 hidden and passes `node --check`; the deployed source no
longer contains `_upsertOverride`; a new deployment version was cut. A leading underscore
does not hide a function from `google.script.run`; only a trailing one does. Before the fix,
`upsertOverride`, `deleteOverride`, `writeClaim` and `clearClaim` were callable by any
`moreh@` member, bypassing the admin gate. 17 functions remain intentionally public.

**2026-09-21 - the portal's write path.** This project is now attached to the
**intranet-truenation** Cloud project and has an **EXECUTION_API** deployment (access: anyone
within the domain). The Next.js portal calls its functions with `scripts.run`, the service
account impersonating the signed-in person, so identity is Google's to enforce - no shared
secret anywhere. The deployment TYPE is set by the gear icon in the deploy dialog, not the
description; a mislabelled Web app deployment fails with an opaque storage NOT_FOUND. Also on
record: the service account's delegation now includes `calendar`, which clears the Calendar
blocker in `migration-checklist.md` Phase 4.

**2026-09-25 - Step 2b DEPLOYED and run, verify clean (484 events).** `create_events.gs`: admin-only
`setCalendarIds`, `createEventsPreview`, `createEventsApply` (resumable), `createEventsVerify`.
First use of `CalendarApp` in this project, so the editor asks for the calendar scope once.

**2026-09-16 - Step 1a written, NOT YET DEPLOYED.** Columns are now found by header name
(`cols_`, `MODE_COLS`, `TAB_COLS`); a missing or duplicated header stops the action with a
clear message. `reopenCompletedCycle` is now admin-only (it had no check). New admin-only
`checkColumns()` to run from the editor. 18 functions public. Tested locally against a fake
spreadsheet: identical results to the old code, and identical again with every tab's columns
shuffled. Deploy: paste `code.gs`, run `checkColumns`, check Triggers for any trigger on
`reopenCompletedCycle` (its owner must be in an admin group), then New version.

### 1.3 Announcements Portal

| | |
|---|---|
| **scriptId** | `1i4iqlVgDMf1cOwc5YFx_2cymqaJUSb5goZE59HLu_aX3kqoTAZyqt3ne` |
| **Deployment** | `https://script.google.com/a/macros/truenation.org/s/AKfycby2MkKLYx-ufgXTsRHt5eM0uOdef5R2zgWKf3P-5JKdDy2kflfPLfM3fcothgRQI3dgmg/exec` |
| **Source** | `scripts/announcements/` |
| **Files** | `Code.gs` (23 fns) · `Manage.gs` · `AccessControl.gs` · 7 HTML |

Sheet `1-Ugl-ZpTBnnldGAECev3ZWyui3PDHU0sD57yjcmwPms`.
Tabs: `items`, `blocks`, `services`, `audit`.
Statuses: Submitted · Needs Info · Approved · Denied · Read · Archived.
Access control lives in `AccessControl.gs` as an `ACL` module with its own `CFG` + `DEFAULTS`.

`getHomeFeed()` in `Manage.gs` is deliberately mirrored by `lib/announcements.js` in the
Vercel app so the review dashboard and the member view can never disagree. **Change both or
neither.**

### 1.4 Profile Editor

| | |
|---|---|
| **scriptId** | `1XD8KQQfphC9Oqk856Z034l3h3G1Qaw7XSxLdymhpSPzZaqGI5MHAMhJd` |
| **Deployment** | `https://script.google.com/a/macros/truenation.org/s/AKfycbzvYnsSNAUz…/exec` |
| **Source** | `scripts/profile editor/` — `code.gs` (13 fns), `profile-editor-ui.html` |
| **Reached from** | My Dashboard on the portal |

Config object `PE_CONFIG` at `code.gs:37`.

### 1.5 Groups + Members — a LIBRARY, not a web app

| | |
|---|---|
| **scriptId** | `1IM0-e9Ihi91qOyBZAgJmw-eUYVM_cLr0Kxji_JgfXY3JBxwJoPgEh2HC` |
| **Library URL** | `https://script.google.com/macros/library/d/1IM0-e9Ihi91qOyBZAgJmw-eUYVM_cLr0Kxji_JgfXY3JBxwJoPgEh2HC/5` (version 5) |
| **Source** | `scripts/groups + members/` — `Code.gs`, 3 functions, **no `doGet`** |

**Status: in good standing - keep it.** No manifest declares it as a dependency yet, and that is
expected, not a bug. Shahad built it to generate lists from live Workspace data and intends to use
it in future work. Do not archive or remove it. (Resolved 2026-09-15.)

---

## 2. Vercel / Next.js app

Repo `shahad-tn/truenation` · local `~/[vercel] truenation-intranet-directory` ·
branch `main` auto-deploys.

- `portal.truenation.org` → staff portal `/portal/*`, NextAuth Google login
- `truenation.vercel.app` → public onboarding (Stage 1)
- `app/page.js` is host-aware

`public/brand.css` is the shared stylesheet **all four Apps Script web apps load**, from
`https://portal.truenation.org/brand.css` (the address in every page's `<link>`; the same file
is also reachable on `truenation.vercel.app`). It is public because `middleware.js` only gates
`/portal/*` and `/directory`. Editing it
needs no Apps Script redeploy — that was the point.

Env vars that must stay: `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` (the
`_OAUTH_` middle matters), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
`GOOGLE_SERVICE_ACCOUNT_BASE64`, `GOOGLE_ADMIN_EMAIL`. Env changes need a redeploy.

---

## 3. Google identities

| Thing | Value |
|---|---|
| Service account | `truenation-directory@intranet-truenation.iam.gserviceaccount.com` |
| SA client ID (domain-wide delegation) | `105017769716672004648` |
| OAuth client | `16223018473-ml9h3b8badenftsan90pp5htidlt4c8c.apps.googleusercontent.com` |
| Redirect URI | `https://portal.truenation.org/api/auth/callback/google` |

SA scopes granted today: `spreadsheets`, `spreadsheets.readonly`, `admin.directory.user`,
`admin.directory.user.readonly`, `admin.directory.group.readonly`,
`admin.directory.group.member.readonly`, `gmail.send`, `drive`.
`calendar` added 2026-09-21. The Teacher Portal's own calendar writes (step 2b) run as the
signed-in admin through Apps Script auto-scoping, not through this service account.

---

## 4. Data stores

| Store | ID | Notes |
|---|---|---|
| Staff data | `1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk` | Tabs: `data`, `Former Staff` (hidden everywhere), `Audit Log`, `Data Backup` |
| Teacher Portal | `1fmbURWbBGIFbWiUZubpY4_KR7RhnCZUGLZOsGHytoV0` | `bible_basics_topics`, `world_history_topics`, `class_config`, overrides |
| Announcements | `1-Ugl-ZpTBnnldGAECev3ZWyui3PDHU0sD57yjcmwPms` | `items`, `blocks`, `services`, `audit` |
| ID documents | `SECURE_ID_FOLDER_ID` | **UNSET** — uploads land in root Drive, domain-shared. Highest open security item. |
| Profile photos / Drive | `1oXTjNqtgenlOgA8t1t_y2365aDaEJsRG` | `DRIVE_FOLDER_ID` in directory `Code.gs` |
| Teachers calendar | `c_9b209f6c75a63b3a2311e226d3de7024544530431629089617b2cfba8823fe72@group.calendar.google.com` | Every class. `config` key `cal_id_teachers` |
| Readers calendar | `c_30f8f2961f68629061c5152bbb1982a8d1e1c735c0c376592a52872b417a8a87@group.calendar.google.com` | Classes with a reader. `cal_id_readers` |
| Graphics calendar | `c_fdd7b951d94adf843ba87f81f9da54613ca4e2e260a126efaf3c9dae7c6afe2b@group.calendar.google.com` | Every class but Q&A. `cal_id_graphics` |
| Public Classes calendar | `c_85c7267c2722d696fbf37ffba64d4c5f40156e85002a88affa960ba56f71018a@group.calendar.google.com` | World-readable. Class and time only. `cal_id_public`. Created 2026-09-25 |
| TNIC Headquarters calendar | `c_96a70c742b0dc21dd4b8fbe39d971107cb22a9ffa22c1cc6d679f55649f140c0@group.calendar.google.com` | Feast days + a monthly event titled `TN Monthly Alms Due` |

Staff data and the Teacher Portal are **separate spreadsheets** — any cross-reference is a
cross-spreadsheet read.

---

## 5. Google Groups

| Group | Role |
|---|---|
| `tn-admin@truenation.org` | Admin everywhere. Nayah is a member. |
| `apostles@truenation.org` | Admin; escalation, reader coordination, postpone authority |
| `bishops@truenation.org` | Admin across the board |
| `moreh@truenation.org` | Teacher Portal access |
| `readers@truenation.org` | Readers |
| `graphics@truenation.org` | Graphics team |
| `it@truenation.org` | **Member-facing contact — always this, never `tn-admin@`** |
| `graphics-lead@truenation.org` | **To be created.** Ratazah. Thumbnail approval. |
| `classes@truenation.org` | **To be created.** Public classes calendar. |

Permissions are always by group, never by individual.

---

## 6. Deploy

**Manual paste and deploy** is the chosen flow. clasp configs exist but are archived and not used.

1. `pbcopy < "<file>"`
2. Paste over the matching file in the Apps Script editor, save
3. **Deploy → Manage deployments → pencil → Version: New version → Deploy**
   Never "New deployment" — that mints a new URL.

Vercel: the user runs `git add -A && git commit && git push`. Claude never runs git.

---

## 7. Known stale references

All resolved as of 2026-09-16:

- Repo path: `portal-status.md` and `CLAUDE.md` now point at `~/[vercel] truenation-intranet-directory`.
  `~/truenation-intranet-directory` (no prefix) is an empty leftover - ignore it.
- "Three deployments" corrected to five in `portal-status.md` and `CLAUDE.md`.
- `CLAUDE.md` now names the Teacher Portal folder `scripts/teachers portal/`.


---

## 8. Superseded documents — do NOT use as reference

### `TrueNation-Intranet-Complete-Guide.md`
A setup guide describing a Google Sites-embedded directory. **It predates the August 2026
migration and almost every specific in it is now wrong.** Verified against
`scripts/directory/Code.gs` on 2026-09-15:

| Guide claims | Live reality |
|---|---|
| `ADMIN_EMAILS` array of 6 addresses; "update it and redeploy" | **No such array exists** (0 occurrences). `isAdmin()` line 166 calls `AdminDirectory.Members.get(ADMIN_GROUP, email)` against `tn-admin@`, cached in `CacheService`. The guide's list also includes `kabashyah@` — **Kabash has left the congregation.** |
| `BRANCHES = ['Congregants','Bishops','Deacons','Apostles']` | `["Congregant","Deacon","Apostle","Judge","Bishop"]` — 5, singular, includes **Judge** |
| 10 cost centers incl. Pastoral Care, Missions, Finance | 6: `General, Youth Ministry, Worship Arts, Outreach, Administration, Operations` |
| `Part-time` / `Full-time` | `Part-Time` / `Full-Time` — capitalisation matters for dropdown matching |
| 13 sheet columns A-M, hardcoded | **No hardcoded header array.** Headers are read from the sheet at runtime (~39 columns) |
| `doGet()` serving `index.html` | `doGet(e)` routes by `?page=`; **there is no `index.html`** — it is `userdirectory.html` |
| Google Sites embed at `portal.truenation.org/people` is "Primary" | **Sites is retired.** `portal.truenation.org` is the Vercel app; GAS pages are first-party, never iframed |
| Vercel app is "Version 1 / original / standalone" | The Vercel app **is** the portal; `truenation.vercel.app` serves onboarding + `brand.css` |
| Redirect URI `truenation-intranet-directory.vercel.app/...` | `https://portal.truenation.org/api/auth/callback/google` |
| 2 delegated scopes | 8 granted on the service account |
| `index.html` styled blue `#2563eb`, `-apple-system` font | `userdirectory.html` contains **zero** occurrences of either colour — it loads `brand.css` (5 refs). Pasting the guide's HTML would destroy the brand system. |
| `getActiveSheet()` | `getSheets()[0]` — matches the documented "always index 0" rule |
| Single sheet implied | Tabs: `data`, `Former Staff` (archive, line 1813 — nothing is permanently deleted), `Audit Log` (line 652) |

**The one thing the guide contributed:** the complete directory `/exec` URL. Every other doc
records only the `AKfycbxrRxV7RHgt9m7F` prefix. The prefix matches, so it is very likely the
same deployment — but confirm in the Apps Script UI before relying on it, since the URL changes
if anyone ever used "New deployment" instead of "New version".

**Unverifiable from the repo, plausible:** Workspace for Nonprofits / Business Starter has no
custom user attributes, which is why extended fields live in a Sheet. Consistent with the
architecture. The Cloud-project setup steps in Part 1 are generic and the service account name
matches.

### Also still present
`<base target="_top">` remains in `scripts/directory/userdirectory.html` (1 occurrence). It is
dead Google Sites iframe machinery — already on the open queue for removal.
