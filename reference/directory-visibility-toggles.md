# Staff Directory — member visibility toggles

Where to change what one member can see about **another** member.

All of this lives in the staff directory Apps Script project, in
`scripts/directory/Code.gs`. None of it affects:

- a member's view of **their own** row (always full), or
- the **admin** view (always full, for every row).

---

## The two switches

Near the top of the "Directory — read (access-filtered)" section:

```js
var MEMBER_VISIBLE_FAMILY   = true;
var MEMBER_VISIBLE_BIRTHDAY = false;
```

### `MEMBER_VISIBLE_FAMILY` — currently `true`

| Value | Effect on the member-facing payload |
|---|---|
| `true` | Spouse and children are included: name and photo |
| `false` | Spouse and children are withheld from members entirely |

**Known trade-off, reviewed and accepted 2026-08-29.** Children have no name
in the staff sheet other than `govFirst` / `govLast` — their government names.
So while this is `true`, every signed-in member can read the full legal names
of every other member's minor children. Flip to `false` if that ever draws a
complaint or a policy changes.

To show **spouses but not children**, the switch alone won't do it — edit
`publicView_` to pass `spouseInfo` through and set `familyMembers: []`.

### `MEMBER_VISIBLE_BIRTHDAY` — currently `false`

| Value | Effect on the member-facing payload |
|---|---|
| `false` | No birthday data reaches a member's browser at all |
| `true` | Adds `sheetData.birthday` as `"MM-DD"` |

Month and day only — the birth **year** is never sent to a member under either
setting, and the full `date_of_birth` column stays admin-and-self only
regardless.

**Turning this on does not put a birthday on screen.** It only puts the value
in the payload. `userdirectory.html` has no code that renders it. To actually
display birthdays you need both:

1. `MEMBER_VISIBLE_BIRTHDAY = true` here, then redeploy, **and**
2. a card change in `userdirectory.html` to render `sd.birthday`

Note that `userdirectory.html` is also queued for a gray-palette pass — worth
doing both edits in one pass rather than touching that file twice.

---

## Changing the field list

Everything else a member may see is this array, in the same section:

```js
var MEMBER_VISIBLE_SHEET_FIELDS = [
  "branch", "gender", "location", "phone", "skills", "ministry_interests"
];
```

Add a sheet column name to widen; remove one to narrow. Anything not listed —
and not one of the two toggles above — is admin-and-self only. As of
2026-08-29 that means: `date_of_birth`, `home_address`, `legal_first`,
`legal_middle`, `legal_last`, `emergency_*`, `ec2_*`, `insurance_*`, `notes`,
`id_front_url`, `id_back_url`, `cost_center`, `start_date`,
`employment_type`, `family_id`, `spouse_legal_*`, `profile_complete_date`.

Google Workspace fields are handled separately in `publicView_`: personal /
recovery email, alternate emails, relations, last sign-in and account creation
date are all blanked for members. Suspended accounts are dropped from the list
for members entirely.

---

## After any change here

1. Save in the Apps Script editor
2. **Deploy → Manage deployments → pencil → Version: New version → Deploy**
3. Reload the directory as an admin, then as a regular member

No client-side change is needed for a toggle flip — the redaction is entirely
server-side, so a member's browser simply never receives the data.

## Why the redaction sits where it does

`getUsers()` is a thin wrapper. The heavy lifting and the 3-minute cache live
in `getUsersFull_()`, which always builds and caches the **complete** dataset.
Redaction runs on every call, *after* the cache read.

This ordering is deliberate. Caching a per-caller payload under the shared
`getUsers_result` key would let an admin's full payload be replayed to the next
member who loads the page. Do not move the filtering inside `getUsersFull_()`.

`isAdmin()` is wrapped in try/catch that falls back to **non-admin**, so a
Directory API scope error reduces what an admin sees rather than expanding what
a member sees.
