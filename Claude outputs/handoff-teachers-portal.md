# Handoff — Teacher Portal work (start here)

**Written 2026-09-12.** Previous chat closed out the announcements home feed and the
Announcements Portal submit-form changes. Everything below is verified working unless
marked otherwise.

---

## 0. Read this first — working rules

- **Claude edits files. The user runs every git command himself.** Hand him bash blocks;
  never execute git. No `#` comment lines inside bash blocks.
- **No `Co-Authored-By` trailer** on commits.
- For anything that gets pasted into Apps Script, hand **one `pbcopy` one-liner per file**.
  Never dump file contents into chat.
- **macOS paths only** in anything the user reads. Never `$HOME/mnt/...` spellings.
- Keep responses short. Confirm before building. One step at a time.
- Say "I don't know, let me verify" rather than building on an unverified theory.
  He does not want a yes-man — push back when something is wrong.
- Permissions by **Google Group**, never by individual. No Google Sites.
- **Everything WCAG 2.1 AA. Sans-serif everywhere, always.** He is a visual learner —
  diagrams and visual instructions where they help.
- **The repo is the authoritative copy.** He pastes repo files into Apps Script, not the
  other way round.

### Correct local paths (portal-status.md is stale on this point)

| What | Path on his Mac |
|---|---|
| Vercel Next.js repo (**the live one**) | `~/[vercel] truenation-intranet-directory` |
| Apps Script sources | `~/Documents/Claude/Projects/True Nation Intranet Project Build` |
| `~/truenation-intranet-directory` | **empty — ignore it.** `portal-status.md` still points here. |

---

## 1. The Teacher Portal — what it is

A standalone Apps Script project. Gated to the `moreh@truenation.org` group. Linked from
My Dashboard and from `/portal/teachers`.

**Files** (`scripts/teachers portal/`):

| File | Size | What it is |
|---|---|---|
| `code.gs` | 25 KB | All server logic. Note the **lowercase** filename — the other projects use `Code.gs`. |
| `index.html` | 28 KB | The portal itself. Tabs are built client-side from `STATE.classes`. |
| `public.html` | 3.8 KB | Read-only schedule view, no login. |
| `denied.html` | 1.4 KB | Shown to anyone not in `moreh@`. |

There is **no `.clasp.json`** in this folder — it was never cloned via clasp. Changes go in
by paste.

### Routing (`doGet`)

```
?view=public[&class=<key>]  -> public.html   (no auth)
in moreh@ group             -> index.html
anything else               -> denied.html
```

`_page()` sets `XFrameOptionsMode.ALLOWALL`, so it can be embedded.

### Configuration block (top of `code.gs`, lines 27–52)

```js
SPREADSHEET_ID = '1fmbURWbBGIFbWiUZubpY4_KR7RhnCZUGLZOsGHytoV0'
MOREH_GROUP    = 'moreh@truenation.org'
ADMIN_GROUPS   = ['tn-admin@', 'apostles@', 'bishops@'] (all @truenation.org)
ADMIN_NOTIFY   = 'it@truenation.org'      // member-facing contact is always it@, never tn-admin@
WEEKS_AHEAD    = 16
```

### The two classes and their two different modes

```js
CLASSES = [
  { key:'bible-basics',  name:'Bible Basics',  day:2 /*Tue*/, tab:'bible_basics_topics',  mode:'claim' },
  { key:'world-history', name:'World History', day:3 /*Wed*/, tab:'world_history_topics', mode:'assigned',
    startTopicId:'WH-029', startDateISO:'2026-07-29' }
]
```

- **`claim` mode** — teachers pick an open topic and a date for themselves
  (`claimTopic` / `releaseTopic`).
- **`assigned` mode** — topics run in a fixed `teach_order` from a start topic on a start
  date. Teachers take a *date* rather than a topic (`grabDate` / `releaseDate`).

This split is the single most important thing to understand before changing anything.
A feature that makes sense for one mode often makes no sense for the other.

### Sheet tabs and column maps

All column positions are **hardcoded index maps** in `code.gs` (`CLAIM_COLS`,
`ASSIGNED_COLS`, `OV_COLS`) — unlike the rest of the intranet, which reads the header row
by name. **Reordering a column in that Sheet will silently corrupt data.** Worth fixing if
you touch this area; flag it to him before doing it as its own change.

### Public API surface (what `index.html` calls)

```
getPortalState()                     the whole render payload
claimTopic / releaseTopic            claim-mode
grabDate / releaseDate               assigned-mode
getAdminData(classKey)
adminSetRotation / adminReorder
adminSetOverride / adminClearOverride / adminAssignClaim
getPublicSchedule(classKey)
reopenCompletedCycle()
```

Admin functions all call `_assertAdmin()`. `_MEMO` caches group lookups per execution.

### Front end

Tabs and panels are generated in JS from `STATE.classes` — one tab per class, plus
**My teaching**, plus **Admin** if `STATE.isAdmin`. Two modals: claim (`.modal`) and
admin edit (`.modal.amber`).

**Watch out:** this project uses `.panel` for its tab panels. `brand.css` previously
painted a global `.panel` wine and broke it. That is why the shared stylesheet's painting
classes are all namespaced `.tn-panel` / `.tn-nav` / `.tn-footer`. **Do not un-namespace
them.**

---

## 2. Brand and styling

All four Apps Script projects and the Vercel portal now load one shared stylesheet:

```
https://truenation.vercel.app/brand.css     (served from the Next.js repo's public/)
```

Editing it needs **no Apps Script redeploy** — that was the whole point. 317 lines:
canonical tokens plus `tn-`-prefixed painting classes.

**Dark mode is designed, staged, and deliberately switched OFF.** The `[data-theme="dark"]`
block is still in `brand.css` but inert, and there is no active `prefers-color-scheme`
block. He has asked three separate times to keep it off. **Do not turn it on without him
asking.** Re-enabling is one media block in `brand.css` plus the matching one in
`userdirectory.html`.

Palette: Dark Wine `#7C1316`, Sovereign Gold `#C9972C` (accents and borders only — never
body text, never gold-on-wine), Warm Snow `#FAF8F4`, Warm Cream `#F2EDE4` (the only text
color on dark grounds), Deep Brown-Black `#130D0A`. Never pure black or white. Barlow
Condensed for display, DM Sans for body.

---

## 3. Just completed (2026-09-12) — context you may need

### Service-account scope fix (was breaking two things)

The domain-wide delegation grant for client ID **`105017769716672004648`**
(`truenation-directory@intranet-truenation.iam.gserviceaccount.com`) was missing
`https://www.googleapis.com/auth/spreadsheets.readonly`. It had `spreadsheets`
(read-write); Google treats those as unrelated scopes.

**Added and verified.** This had been silently breaking both the new announcements feed
*and* `lib/staff.js` (the My Dashboard staff read). Both now authenticate.

Currently granted on that client: `spreadsheets`, `spreadsheets.readonly`,
`admin.directory.user`, `admin.directory.user.readonly`, `admin.directory.group.readonly`,
`admin.directory.group.member.readonly`, `gmail.send`, `drive`.

### Home-page announcements feed — live

`lib/announcements.js` (new) reads the Announcements Sheet
`1-Ugl-ZpTBnnldGAECev3ZWyui3PDHU0sD57yjcmwPms`, tab `items`, and applies the *same* rules
as `getHomeFeed()` in the Announcements Portal's `Manage.gs` — ported deliberately so the
review dashboard and the member view can never disagree. `app/portal/page.js` is now an
async Server Component with `revalidate = 300` (5-minute cache). Verified end to end.

### Announcements submit form — home-only announcements

`Code.gs` + `submit.html` in `scripts/announcements/`. Channel is now resolved first and
decides what is required: the service dropdown only applies to read-aloud items and is
hidden (and cleared) for home-only; category stays required for every channel. New
"Start showing it on" date writes `home_from`. A blank end date now means the item runs
until a reviewer pulls it.

**Known coupling, not yet addressed:** one end-date field still drives both `expires_on`
and `home_until`, so a "Read aloud + Home page" item drops off the home page the day after
its service. Splitting those is a separate change if he wants it.

---

## 4. Open queue (not Teacher Portal — carry forward)

1. **Teachers Portal rename** — he wants it renamed. Name not yet decided.
2. **Proximity map** — blocked on five unanswered questions.
3. **Birthday render hook** — not started.
4. Remove `TrueNation_CommunityBrandGuide_Final_5.pdf` from the Claude Project. **He must
   do this himself in claude.ai** — project file uploads are read-only via the Projects
   tool. Also check the Drive brand-assets folder for the same superseded PDF.
5. Backfill split address columns for staff rows that only have `home_address`.
6. **ID documents are DOMAIN-shared.** `SECURE_ID_FOLDER_ID` is unset, so uploads land in
   root Drive, and `setSharing` is inside a non-fatal catch. This is the most security-
   sensitive open item.
7. Hebrew fields are vestigial in the main `Code.gs` — 7 references including the header
   array at line 1138.
8. `.gitignore` needs `.DS_Store` and `.fuse_hidden*`; `git rm --cached` the tracked one.
9. Update `portal-status.md` — its local repo path points at the empty folder.
10. Remove dead Google-Sites-era code from `scripts/announcements/` — `tnic-height`
    reporters and `<base target="_top">`.
11. Rate-limit the public `/api/onboard` route.

---

## 5. Hard-won gotchas (do not relearn these)

- **All `.gs` files in one Apps Script project share a single global scope.** Two files
  each defining `doGet` is a silent collision — it caused a live outage.
- **CSS comments do not nest.** Commenting out a block that contains `/* … */` closes the
  wrapper early and silently ships broken CSS. Delete blocks; don't comment them out.
- **A hex sweep of `#[0-9A-Fa-f]{6}` misses every `#fff`.** That mistake shipped 60 broken
  colors across four projects.
- **Insert FOUC guards *after* any token sweep**, never before — a sweep rewrites the
  guard's literals into `var()`s that don't exist yet.
- **Never `.replace()` without an assert that it matched.** A silent no-op reported as
  success has burned this project more than once. Assert the count, then read back.
- **Never claim a file parses without actually running the parser.** esbuild can fail to
  install through the proxy and a chained `&&` will still print the success line.
- **Escaped unicode like `★` renders as literal text in JSX.** Use the character.
- `find` with folder names containing spaces needs `-print0` + `while IFS= read -r -d ''`.
- Vercel serves the previous deployment while building. "Nothing changed" usually means
  it is still building — check that before theorizing.
- Email subjects: **plain hyphens only**, never em dashes (mojibake).
- Sheet writes elsewhere in this project: read the header row first, add missing columns,
  write by name. Always sheet index 0, never a named tab. (The Teacher Portal is the
  exception — it uses hardcoded index maps. See §1.)

---

## 6. Deploy

**Vercel** (user runs):

```bash
cd "$HOME/[vercel] truenation-intranet-directory"
git add -A
git commit -m "..."
git push
```

Pushing `main` auto-deploys.

**Apps Script**: user pastes the file, then redeploys that project manually. Editor content
is not the deployed version until he cuts a new deployment version.
