# Handoff — one shared stylesheet for every Apps Script project

**Goal:** one `brand.css`, hosted on Vercel, used by all four Apps Script projects
and the Next.js portal. Edit it once, `git push`, and every page updates with **no
Apps Script redeploy anywhere.**

Read `NEW_CHAT_HANDOFF.md` for how Shahad works before starting. The short version:
Claude edits files and hands him bash blocks plus a `pbcopy` one-liner per file; he
runs every git command and every Apps Script paste himself.

---

## Why this approach

Decided 2026-09-05 after the announcements portal shipped a bug caused by exactly
this problem — a rule was added to `styles.html`, but `submit.html` doesn't
`include('styles')`, so the fix never reached the page and a confirmation panel
stayed visible under the form.

Three of the six announcements pages carry their own `<style>` block:

| Includes `styles.html` | Has its own stylesheet |
|---|---|
| `review.html`, `script.html`, `home.html` | `submit.html`, `access.html`, `denied.html` |

And that's one project out of four. The same divergence almost certainly exists in
Teachers Portal, Profile Editor and TN Operations Scripts.

**Alternatives considered and rejected:**

- *Apps Script Library* — a standalone "TN Brand" project exposing `TNBrand.css()`.
  Real sharing, but libraries are version-pinned: every change means deploying a new
  library version and then bumping the version in all four consumer projects. That's
  the same four-project chore, plus per-call latency on every page load and a
  permissions wrinkle (users need read access to the library project).
- *Copy the file into each project* — status quo, times four.

**Proof the Vercel approach works in Apps Script:** these pages already load an
external stylesheet — `submit.html` line 7 pulls Google Fonts from
`fonts.googleapis.com`. Same mechanism, different host.

---

## Do this first — the survey (read-only)

**Do not start writing `brand.css` before this.** Nobody has yet checked how much of
the four projects' CSS is genuinely common versus superficially similar. The survey
decides whether the shared file is 60 lines or 300, and it may turn up per-project
palettes that have already drifted.

1. Confirm which sources are in the repo and which live only in Apps Script. In
   `~/Documents/Claude/Projects/True Nation Intranet Project Build/scripts/`:
   `announcements/` and `directory/` are there. **Teachers Portal and TN Operations
   Scripts may not be — ask Shahad, and get them into the repo first if not.**
2. Extract every `:root` block and compare token values across projects. Expect drift.
3. Sort the rest into: **shared** (reset, tokens, typography, buttons, cards, nav,
   toast, loading, `[hidden]`) vs **page-specific** (the `.sb-*`, `.rs-*`, `.db-*`
   families — these stay in their pages).
4. Report the split to Shahad and get sign-off on the token values before building.
   He will have opinions; several were hard-won (see Brand notes below).

---

## The build

### 1. The file

`public/brand.css` in the portal repo (`~/truenation-intranet-directory`), served at
`https://portal.truenation.org/brand.css`.

Verified safe: `middleware.js` gates only `/portal/:path*` and `/directory`, so
`public/` is served unauthenticated. That is required — the Apps Script sandbox frame
fetches the stylesheet cross-origin and must not hit a sign-in redirect. Brand CSS
carries nothing sensitive.

**No CORS headers needed.** Stylesheets loaded via `<link>` are not subject to CORS
(unlike fonts or `fetch`). Don't go chasing CORS errors — if the sheet doesn't apply,
the cause is something else.

### 2. Cache headers — needs a decision

Default Vercel caching could leave stale CSS in browsers after an edit, which
undermines the whole point. Add a `headers()` entry in `next.config.js` for
`/brand.css` with a short `max-age` plus `stale-while-revalidate`. Propose the actual
values to Shahad rather than picking silently.

Avoid a `?v=2` cache-buster in the URL — bumping it would mean editing and
redeploying every Apps Script page, which is the chore this removes.

### 3. What each page gets

```html
<link rel="stylesheet" href="https://portal.truenation.org/brand.css">
```

Plus a small inline block for **background colour and font stack only**, to avoid a
flash of unstyled content while the external sheet arrives. Everything else lives in
the shared file.

### 4. The Next.js portal

Import the same file so the portal and the Apps Script pages can never drift.

### 5. Rollout — one project at a time

Announcements first (its sources are fully in the repo and its state is well
understood as of 2026-09-05). Verify every page visually before moving on. Do not
convert all four in one pass.

---

## Watch out for

- **Partial deploys are fatal in Apps Script.** When a change spans several files,
  all of them must be pasted, `Code.gs` first. A template referencing a server
  variable the deployed `Code.gs` never set is a hard `ReferenceError` that takes the
  whole page down. Give Shahad a token to Cmd+F for before he deploys.
- **`[hidden]{display:none !important;}` must be in the shared file.** Author rules
  like `.sb-wrap{display:grid}` and `.rs-bar-row{display:flex}` outrank the UA
  `[hidden]` rule. This has already caused one production bug.
- **Toggle visibility with `el.hidden`, never inline `style.display`.** Leftover
  inline styles fight the shared rule.
- If Vercel is unreachable the pages render unstyled but still function. Acceptable;
  worth telling Shahad it's the trade.

## Brand notes that must survive the consolidation

- Control borders are **`#767680`**, not the brand guide's `#86868F` — the guide's
  value measures 2.95:1 on the page ground and fails WCAG 1.4.11.
- Gold is **never** body text. `#C9972C` for fills and borders only, `#785710` for
  text on light, `#D4A94D` for text on wine. The guide's claimed 4.6:1 for `#C9972C`
  on Warm Snow is wrong — it measures 2.49:1.
- Never pure black or pure white. Sans-serif only. Everything WCAG AA.
- The gray palette (`--page:#E8E8EC`, `--surface:#D8D8DE`) was a deliberate change to
  reduce eye fatigue from stacked tans. Do not revert it to the tan values in the
  brand guide.