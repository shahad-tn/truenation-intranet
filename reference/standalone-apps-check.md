# Standalone Apps Script pages — check & redeploy list

Created 2026-08-29 after the gray surface pass. **Read the warning first.**

---

## ⚠ Source and deployment are now out of sync

The palette sweep changed the **local source files** in this folder. Apps Script
does not read from this folder — it serves whatever is pasted into the Apps
Script editor. Until you paste and redeploy, every one of these pages is still
serving the old warm palette while the file on disk says otherwise.

Nothing is broken by waiting. But do not assume a page is updated because the
file here looks updated.

---

## 1. Swept locally — needs paste + redeploy

| File | Apps Script project | Status |
|---|---|---|
| `scripts/bible-basics-portal/index.html` | Teachers Portal | swept, not deployed |
| `scripts/bible-basics-portal/public.html` | Teachers Portal | swept, not deployed |
| `scripts/bible-basics-portal/denied.html` | Teachers Portal | swept, not deployed |
| `scripts/profile-editor-ui.html` | Profile editor | swept, not deployed |
| `scripts/profile-editor.gs` | Profile editor | swept, not deployed |
| `scripts/quick-links.gs` | Quick links | swept, not deployed |
| `scripts/Members Hub/True Nation Member Hub.dc.html` | design reference only | swept, do **not** deploy |
| `scripts/Members Hub/True Nation Alms Commitment.dc.html` | design reference only | swept, do **not** deploy |

> The `.dc.html` files are Design Component originals. Per the project reference
> they are **never** deployed — the live Hub/Alms are flattened templates. They
> were swept only to keep the design reference visually consistent.

**Check after redeploying each one:** headings still legible on wine, small gold
labels are readable, card edges visible against the page ground, nothing washed
out inside the Google Sites iframe (the iframe renders at 980px regardless of
device — test on the real Sites page, not just `/exec`).

---

## 2. NOT swept — needs its own pass

### `userdirectory.html` — highest traffic page on the intranet

**This file does not exist in this folder.** It lives only as an Apps Script
deployment and as a doc in the Claude Project. It still uses the warm palette
throughout, so the directory will visibly clash with every other page once the
embeds go live.

Known values to change (from the class documentation in `CLAUDE.md`):

- `.di-wrap` background `#FAF8F4` → `#E8E8EC`
- Badge text `color: #FAF8F4` → `#F2F2F3` on all five branch badges
  (backgrounds `#8C1C1C`, `#1E3A8A`, `#1A5C2A`, `#8B6200`, `#130D0A` are branch
  identity colours and stay as they are)
- Body text `#130D0A` → `#26262A`, secondary `#3D2E28` → `#56565E`
- Card borders `#F2EDE4` → `#BFBFC7`; control borders → `#86868F`
- Any gold used as **text** → `#785710` (see the correction note below)

To do this properly, pull the file into this folder first so the sweep is
reviewable and repeatable rather than hand-edited in the Apps Script editor.

### Member Hub eyebrow labels

The Hub already darkened its gold eyebrow labels from `#C9972C` to `#8A6D1A`,
described at the time as ~4.6:1. Measured properly that value is **4.20:1 on the
old cream and 4.01:1 on the new page ground** — below the 4.5:1 that AA requires
for normal-size text. Change to `#785710`.

---

## 3. Naming — needs your confirmation

You referred to the **Teachers Portal** as the new replacement name for what
this folder calls the *Bible Basics portal*. I have **not** renamed anything —
this was inferred from one line and a rename touches a folder, several files,
project memory, and the setup doc.

Confirm which you want:

- **(a)** Teachers Portal replaces "Bible Basics portal" everywhere — the portal
  is the container, Bible Basics is one class inside it. This reading matches
  the code, which already has a `CLASSES` array holding both Bible Basics and
  World History, and a `MOREH_GROUP` gate covering teachers generally.
- **(b)** Something narrower — only the user-facing title changes.
- **(c)** Nothing changes; the name was incidental.

(a) is the likeliest reading and matches how the code is already built, but a
rename is not the sort of thing to do on an inference.

Affected if (a): `scripts/bible-basics-portal/` folder name,
`reference/bible-basics-portal-setup.md`, `reference/bible-basics-portal-mockup.html`,
`reference/bible-basics-topic-picker-spec.md`, `reference/bible_basics_topics.csv`,
the `bible_basics_topics` sheet tab, the `bible-basics` class key in `Code.gs`,
and the project memory entry.

> Renaming the **sheet tab** and the **class key** would break the running app
> unless done together with a data migration. The safe version of (a) renames the
> *portal* — folder, docs, page titles — and leaves `bible_basics_topics` and the
> `bible-basics` class key alone, since those correctly refer to the class, not
> the portal.

---

## 4. The correction worth knowing

The brand guide claimed Sovereign Gold `#C9972C` on Warm Snow was **4.6:1**.

It is **2.49:1**.

Gold text never met WCAG AA, at any size, anywhere it was used. This is a
pre-existing defect that predates the gray change — the gray ground made it
marginally worse (2.16:1) but did not cause it. It is now fixed across the
embeds and the master reference by splitting gold into three values by job:

| Job | Value |
|---|---|
| Borders, rules, filled badges | `#C9972C` (unchanged) |
| Text on a light ground | `#785710` |
| Text on wine | `#D4A94D` |

If you disagree with `#785710` — it is noticeably more bronze than the brand
gold — the alternative is to stop using gold for text entirely and let wine
carry those labels. That would be more faithful to the brand and is worth
considering. `#785710` was chosen because it preserves the existing visual
hierarchy without a redesign.
