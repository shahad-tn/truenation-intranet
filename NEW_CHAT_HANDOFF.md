# Handoff — 2026-09-03

Repo: `shahad-tn/truenation-intranet` (this folder).
Portal repo: `shahad-tn/truenation` at `~/truenation-intranet-directory`.
**Read `portal-status.md` first**, then `CLAUDE.md`.

---

## How Shahad works — read before anything

- **He/him.**
- **He runs every git command himself.** Claude edits files and hands him a bash
  block. Never run git for him.
- **No `#` comment lines in bash blocks** — his zsh has `interactive_comments` off.
- **No `Co-Authored-By:` trailer** in commit messages.
- **Hand him a `pbcopy` one-liner** to get a file onto his clipboard for pasting into
  Apps Script. Never dump a whole file into chat.
- **macOS paths only**, never the bridge's `$HOME/mnt/...` spelling.
- **Keep responses short.** He asked for this explicitly on 2026-09-03.
- **Confirm before building.** One step at a time.
- **Say "I don't know, let me verify"** rather than building on an unverified theory.
  His words: *"I would rather you confidently state that you're not sure and need to
  look into it than make an incorrect assumption or build on an unverified idea."*
- **Challenge him when he's off.** *"I don't want a yes man… I always want the truth,
  plain and clear w/o any fluff. I'm operating with no ego."*
- **Permissions are by Google Group, never by individual.**
- **No Google Sites.** Vercel + standalone Apps Script pages, never iframed.
- Don't infer he ran a command from side effects. Wait for him to say so.

---

## Shipped this session

1. `getGroupMembers` — `isAdmin()` guard (any member could enumerate `tn-admin@`).
2. `getMapsApiKey` — guard added, then **reverted**; it broke members and secured
   nothing. Reasoning is in the function comment. Do not re-add.
3. `CLAUDE.md` rewritten off the retired Sites architecture. Old copy in `archive/`.
4. `userdirectory.html`, `brand-styles.html`, `profilesetup.html`,
   `profilesetup_desktop.html` **added to `scripts/directory/`** (were repo-less).
5. `userdirectory.html` gray palette pass — 38 contrast pairs measured, 0 failing,
   **10 AA failures fixed**, 6 of which predated the palette change (worst: `--muted`
   at 3.19:1 across 45 usages).
6. **Address autocomplete fixed.** Two stacked causes, see below.
7. `reference/proximity-map-design-note.md` written (proposed, not built).

---

## The autocomplete bug — hard-won, don't repeat it

Two independent causes:
- **Cloud billing was not enabled.** Note: billing is **per project**, and the key
  belongs to one project. Enabling it on the wrong project looks correct and does
  nothing. Enabling billing does **not** auto-enable Maps JavaScript API / Places API.
- **`.pac-container` z-index 1000 vs modal overlay 8000.** Dropdown rendered in the
  DOM, populated, on screen — and painted behind the modal.

**Four wrong theories** were burned before the real one: the `isAdmin()` guard, a CSP
note in `CLAUDE_CODE_HANDOFF.md`, the `places.Autocomplete` deprecation warning (it is
a *warning*, not an error), and a timing bug. Do not revisit them.

**What worked:** instrument the real path, in order, verifying each step —
`AutocompleteService.getPlacePredictions()` directly → an `input` event listener
printing `e.target.id` → reading `.pac-container` computed style and box.

**Console gotchas that produce false readings:** the DevTools frame selector resets to
`top` on every reload (must be `userHtmlFrame`); `google.maps` loads async; and
`new Autocomplete(...)` **always** succeeds — a construction test is a false green,
the request only fires on real typing.

---

## Open queue, recommended order

1. **Cloud quota caps + budget alert + API restriction.** The only unmitigated risk.
   `MAPS_API_KEY` is readable by every signed-in member by design (`doGet` injects it
   into the profilesetup templates). Billing being off used to make that harmless; it
   no longer is. Skip the referrer restriction — GAS serves from a randomized
   `*.googleusercontent.com` origin. Quota caps are the real control.
2. **Delete the stale project doc `saveProfile_Code.gs`** — it uses
   `DriveApp.Access.ANYONE_WITH_LINK` for government ID uploads.
3. **`brand-styles.html` gray pass** — the last warm-palette file. Confirm what
   actually includes it first; the live `userdirectory.html` does **not**. Its
   `--gold-dk: #8a6b18` measures 5.00:1 and is fine.
4. **Redeploy the pages swept on 2026-08-29** — bible-basics ×3, profile-editor ×2,
   quick-links. Source is gray, deployments are still warm. See
   `reference/standalone-apps-check.md`.
5. **Home announcements feed as a native Next.js component** reading the Sheet — not
   the GAS `home.html`. Biggest user-visible win left.
6. **Birthday render hook** — `MEMBER_VISIBLE_BIRTHDAY` is `false`; flipping it adds
   `MM-DD` to the payload but the card needs a render change. Needs his decision.
7. Remove dead Sites-era code from `scripts/announcements/` — `home.html`, the
   `tnic-height` reporters, `<base target="_top">`.
8. `.gitignore` `.DS_Store` and `.fuse_hidden*`; `git rm --cached` the tracked one.
9. **Teachers Portal rename** — unconfirmed. Options in `standalone-apps-check.md` §3.
10. **Proximity map** — design note exists; blocked on his five open questions.

---

## Conventions worth knowing

- **Apps Script deploy:** paste whole file → Save → Deploy → **Manage deployments** →
  pencil → New version. Never "New deployment" (mints a new URL).
- **Repo/deployment drift is the recurring failure here — it has cost a round trip
  three times.** The repo is the source of record; the running app is NOT. When a
  change spans more than one file, ALL of them must be pasted together, and `Code.gs`
  first: a template that references a server variable the deployed `Code.gs` never
  set is a hard `ReferenceError` in Apps Script and takes the whole page down, not
  just the feature. Before deploying, verify with Cmd+F in the Apps Script editor for
  a token unique to the newest edit (e.g. `appUrl_`, `getUsersFull_`). Hand Shahad
  that token to search for, and never assume a paste landed — wait for him to confirm.
- **Only a TRAILING underscore** hides a function from `google.script.run`.
- **In-app GAS links:** build from `appUrl_()`, read params from the server template,
  never from `window.location` — these pages render in a sandbox frame with no query
  string.
- **Sheet writes:** read the header row first, append missing columns, never hardcode
  positions. Always sheet index 0.
- **Brand:** control borders are **`#767680`**, not the guide's `#86868F` (2.95:1 on
  the page ground, fails WCAG 1.4.11 where `.search-input` sits). Gold is never text —
  `#785710` on light, `#D4A94D` on wine. Never pure black or white. Sans-serif only.
- **Member-facing contact is `it@truenation.org`**, never `tn-admin@`.
- **Departed:** Kabash, Kanash, Yashan. Deacons: Kahan, Ahman, Rakab, Shamar, Raiyah,
  Shahad.
- **Trap:** the Claude Project doc copy of `userdirectory.html` is a *different, older
  lineage* than the live file. Read the repo, not the doc.
