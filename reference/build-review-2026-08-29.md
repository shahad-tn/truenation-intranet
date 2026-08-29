# Build review — announcements module + intranet palette pass

2026-08-29, overnight. Everything below was found by reviewing my own work after
building it. Bugs I introduced and then fixed are listed too — you should be able
to see what nearly shipped, not just what did.

---

## 1. The serious one: leading underscores do nothing in Apps Script

**Found and fixed.**

I wrote the server helpers as `_read`, `_append`, `_setCell` — the convention I
use everywhere else. In Apps Script that convention is wrong. Only a **trailing**
underscore makes a function private to `google.script.run`. A leading one is
just a character.

Which meant this worked, from any signed-in member's browser console:

```js
google.script.run._setCell('items', 7, 'status', 'Approved')
```

Any member could have written any value into any cell of any tab — approving
their own announcements, rewriting standing text, editing the access rules — with
the entire `AccessControl.gs` layer sitting there untouched, because nothing
routed through it.

Fixed: every helper renamed to the trailing form (`readTab_`, `appendRow_`,
`setCell_`, `findItem_`, …). Verified no leading-underscore globals remain, and
verified by script that every function which writes now calls `ACL.require()`
first.

**The lesson is general, and it applies to your existing apps.** `Code.gs` in the
directory project and the Teachers Portal use the same `_helper` naming. Worth
checking whether any of them writes data — `_uploadToDrive`, `_writeUpdates`,
`_ensureColumns`, `_getStaffSheet` are all exposed by the same rule. I have not
touched those files' function names; that is your call, and it needs a redeploy.

## 2. Setup functions were reachable too

**Found and fixed.** `setupAnnouncements()`, `seedServices()` and `seedBlocks()`
are ordinary globals, so a member could have called them. Now gated.

That created a bootstrap problem I then had to fix: `setupAnnouncements` needs
`core/access_admin`, but that rule lives in the tab setup creates. First run
would have thrown. It now allows exactly one case — the `access_control` tab not
existing yet — where the spreadsheet is empty and there is nothing to take.

## 3. I got my own gold value wrong

**Found and fixed.** I picked `#8C6512` and wrote "4.3:1, passes AA." It does
not. AA needs 4.5:1 for normal-size text, and most gold text on the intranet is
small uppercase labels. 4.3 fails.

Replaced with `#785710` — 5.4:1 on the page ground, 6.6:1 on cards, 4.7:1 on
surface fills. Passes on all three. All 117 files updated, base64 previews
included, and the documented ratios corrected.

Worth noting the Member Hub made a version of the same mistake earlier: it
darkened gold to `#8A6D1A` and recorded it as "~4.6:1." Measured, that is 4.20:1
on cream and 4.01:1 on the new ground. Also below AA. It still carries that value.

## 4. The brand guide's contrast figure was wrong

**Pre-existing, now corrected in the docs.** The guide claimed `#C9972C` on Warm
Snow was 4.6:1. It is **2.49:1**. Gold text never met AA anywhere it was used,
which is a defect that long predates last night. The gray ground made it slightly
worse (2.16:1) but did not cause it.

Gold is now documented as three values by job — fill/border `#C9972C`, text on
light `#785710`, text on wine `#D4A94D`.

## 5. A blind find-and-replace would have broken the banners

**Avoided.** `#F2EDE4` had two unrelated jobs: surface fill *and* text on wine.
Six rules in `tnic-brand-styles.html` used `color: var(--tn-cream)` for headings
on burgundy. A straight swap to the new surface gray would have left dim gray
text on wine across every banner and wine button.

The sweep classifies by CSS property (`background`/`border`/`color` map to
different values), and those six were repointed to a new `--tn-onwine` token.

## 6. Performance: an O(n²) write loop

**Found and fixed.** `moveHomeItem` called `findItem_` per row while renumbering,
and `findItem_` re-reads the entire `items` tab. Reordering ten home-page items
meant ten full-sheet reads. Now reads once and indexes by id.

## 7. Smaller things fixed

- Unused `ACL.can()` result left in `getScriptFor`.
- `review.html` nulled `STATE.services` before an async refresh, which could blank
  the services table for a moment.
- `seedBlocks` numbered `sort_order` per section, so an `all`-type line and a
  `sabbath`-type line in the same section both got order 1 and tied. Now one
  running counter in steps of 10, so the array order *is* the reading order and
  there is room to insert between lines later.

## 8. Verified, not just assumed

- Every `.gs` file and every inline `<script>` passes `node --check`.
- All 13 client→server calls resolve to real global functions.
- All template variables used in the HTML are set in `doGet`.
- 123 embeds: balanced `<style>` blocks, no malformed hex, no dangling values.
- Master reference: 134/134 balanced textareas, all 18 base64 previews decode and
  carry the new palette.
- Full contrast matrix: 15 combinations, zero failures.

---

## Still open — needs your judgement

**Version control does not work through this connection.** `git init` inside the
mounted folder fails: the mount does not permit the unlink operations git needs
to manage its own object store and index lock, and `reference/build-reference.xlsx`
is currently held open by LibreOffice on your Mac. I moved the half-created `.git`
to `_to_delete/failed-git-init-20260829` rather than leave a broken repo behind —
I cannot delete files here, so please remove that folder yourself. A `.gitignore`
is in place and is worth keeping.

To set this up, from Terminal on your Mac:

```bash
cd ~/Documents/Claude/Projects/"True Nation Intranet Project Build"
rm -rf _to_delete
git init && git add -A
git commit -m "Announcements module, access control, gray palette"
```

Then create an empty **private** repo — `truenation-intranet` — and:

```bash
git remote add origin git@github.com:shahad-tn/truenation-intranet.git
git push -u origin main
```

I would keep it separate from `shahad-tn/truenation`. That repo is the Vercel
Next.js app and auto-deploys on push to `main`; mixing embeds and Apps Script
sources into it means every brand tweak triggers a production deploy.

**Nothing is deployed.** The palette changes are on disk only. Apps Script serves
what is pasted into its editor, so the Teachers Portal, profile editor and quick
links are still serving warm colours. See `standalone-apps-check.md`.

**`userdirectory.html` has not been touched** — it does not exist in this folder.
It is the highest-traffic page and will visibly clash once the embeds go live.

**The Teachers Portal rename is unconfirmed.** I did not rename anything based on
one inferred line. Options are laid out in `standalone-apps-check.md`.

---

## Suggestions, not defects

**Off-brand pastel tags.** Several embeds use Material-palette chips —
`#E3F2FD`/`#1565C0`, `#FFEBEE`/`#C62828`, `#F3E5F5`/`#7B1FA2` — that predate the
brand system and were left alone. They pass contrast but look borrowed. Worth
folding into the brand palette at some point.

**Consider retiring gold as a text colour entirely.** `#785710` is noticeably
more bronze than Sovereign Gold. It preserves the existing hierarchy without a
redesign, which is why I chose it, but letting wine carry those labels would be
more faithful to the brand than a gold that has to be darkened until it stops
looking like the brand gold.

**The old token names now lie a little.** `--tn-snow` and `--tn-cream` hold gray
values. I kept the names deliberately so 120 embeds keep working, but it is
confusing to read. A future pass could rename them to `--tn-page` / `--tn-surface`
with the old names aliased.

**The announcements queue has no pagination.** Fine at your volume. If a Feast Day
ever draws forty submissions, `getReviewState` returns them all in one payload.
