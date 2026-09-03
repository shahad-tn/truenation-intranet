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

## 2. Swept 2026-09-03 — needs paste + redeploy

### `userdirectory.html` — highest traffic page on the intranet

**Now in the repo** at `scripts/directory/userdirectory.html`, alongside
`brand-styles.html`. Both were pulled from the Apps Script project and committed
unmodified first, so the palette change diffs against a real baseline.

> **The plan that used to be in this section was wrong.** It listed `.di-wrap`
> and the five `.badge-bi`/`-ap`/`-de`/`-ju` branch badges as the things to
> change. None of those classes exist in `userdirectory.html` — they are from
> the Sites-era embeds documented in `CLAUDE.md`. The plan had been written from
> a description of the file instead of the file. It is replaced by what was
> actually done, below.

**The live file is self-contained.** It carries its own `:root` block and does
**not** `include('brand-styles')`. The copy of `userdirectory.html` in the Claude
Project doc is a *different, older lineage* that does include it — do not treat
that doc as current. Sweeping this page therefore touched nothing else: profile
setup, Hub and Alms were unaffected.

What changed in the token block:

| Token | Was | Now | Role |
|---|---|---|---|
| `--snow` / `--warm-50` | `#FAF8F4` | `#E8E8EC` | page ground |
| `--surface` | *(new)* | `#D8D8DE` | chips, disabled fields |
| `--cream` | `#F2EDE4` | `#BFBFC7` | dividers (decorative) |
| `--cream-dk` | `#E8DDD2` | `#767680` | **control borders** |
| `--brown` / `--bark` / `--slate` | `#130D0A` / `#3D2E28` | `#26262A` | ink |
| `--muted` | `#9a8e87` | `#56565E` | secondary text |
| `--border` | `#F2EDE4` | `#BFBFC7` | decorative border |
| `--gold-dk` | `#A07820` | `#785710` | gold as text |
| shadows | `rgba(19,13,10,…)` | `rgba(20,20,24,…)` | neutral |

Plus 25 hardcoded `#F2EDE4` → `#F2F2F3` (text on wine), the avatar placeholder
ground `#8B7A72` → `#6E6E78`, and the warm `rgba()` values neutralised.

**Six AA failures were found and fixed along the way — none of them caused by
the gray change.** They were live defects in the warm palette:

| What | Was | Measured | Now | New |
|---|---|---|---|---|
| `--muted` secondary text (45 uses) | `#9a8e87` | 3.19 | `#56565E` | 7.27 |
| `--gold-dk` section labels (9 uses) | `#A07820` | 4.04 | `#785710` | 6.63 |
| Gold text | `#B5852A` | 3.31 | `#785710` | 6.63 |
| Avatar initials ground | `#8B7A72` | 3.51 | `#6E6E78` | 4.51 |
| Control borders | `#E8DDD2` | 1.34 | `#767680` | 4.49 |
| `.btn-ok` fill | `#16a34a` | 2.95 | `#14743a` | 5.23 |

Also darkened: `.btn-danger` `#dc2626`→`#c41f1f` (4.32→5.27), `.clear-btn`
active `#dc2626`→`#c81e1e` (4.41→5.24), `.remove-btn:hover` `#dc2626`→`#a81717`
(3.34→5.18), the load-failure message `#c0392b`→`#b32e22` (4.45→5.16), and the
completeness ring's `mid` stroke from `--gold` to `--gold-dk` (2.64→6.63 against
the 3:1 that WCAG 1.4.11 requires of graphical objects). The ring track moved
from `--cream-dk` to `--border` so it reads as a track rather than out-darkening
its own fill.

**Note on `#767680` vs the `#86868F` in the brand guide.** `#86868F` reaches
3.61:1 on white but only **2.95:1** on the page ground — and `.search-input` sits
on the page ground, so the documented value fails WCAG 1.4.11 exactly where this
page uses it. `#767680` clears 3:1 on all three surfaces (4.49 / 3.68 / 3.17).

**Verified:** 38 foreground/background pairs measured, 0 failing. CSS braces
balanced, no undefined `var(--…)` references.

**Still to do on this page:** the birthday render hook
(`MEMBER_VISIBLE_BIRTHDAY` is `false`; flipping it adds `MM-DD` to the payload
but the card needs a render change to show it).

### `brand-styles.html` — not swept

Now in the repo at `scripts/directory/brand-styles.html`, unmodified. It still
carries the warm palette. **Its consumers are unverified** — its own header
comment claims `index.html` and `profilesetup.html`, but the live
`userdirectory.html` (which is the Main project's directory page) does not
include it. Confirm what actually includes it before sweeping, or the change
lands somewhere unexpected.

One measurement worth recording: `--gold-dk: #8a6b18` in that file is **5.00:1
on white and already passes AA.** It is not one of the gold-as-text defects.


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
