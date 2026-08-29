# TNIC Announcements — Setup

Files in this folder go into **one** Apps Script project. `AccessControl.gs` is
written to be reused across the whole intranet — copy it into other TNIC script
projects as-is.

| File | Type | What it is |
|---|---|---|
| `AccessControl.gs` | Script | Reusable group-based permissions. Module + capability + groups. |
| `Code.gs` | Script | Router, sheet helpers, submission server, setup + seeding. |
| `Manage.gs` | Script | Review queue, standing text, reader script, home board and feed. |
| `styles.html` | HTML | Shared brand tokens, pulled in with `include('styles')`. |
| `submit.html` | HTML | The member submission form. |
| `review.html` | HTML | Dashboard: review queue, standing text, home page, services. |
| `script.html` | HTML | The reader's script for one service. |
| `home.html` | HTML | The public feed, embedded on the intranet home page. |
| `access.html` | HTML | Built-in UI for editing who can do what. |
| `denied.html` | HTML | Shown when someone lacks a capability. |

> When creating the HTML files in the Apps Script editor, name them exactly
> `styles`, `submit`, `review`, `script`, `home`, `access`, `denied` — no
> extension. `include('styles')` fails if the styles file is named anything else.

---

## 1. Create the Sheet

New Google Sheet, name it **TNIC Announcements**. Copy its ID from the URL
(the long string between `/d/` and `/edit`).

## 2. Create the Apps Script project

Extensions → Apps Script from that Sheet (container-bound is simplest — then you
can leave `spreadsheetId` blank in both files). Create the five files above and
paste the contents in. HTML files: **File → New → HTML file**, and name them
exactly as the table above (no `.html` when creating).

## 3. Enable the Admin SDK

In the editor sidebar: **Services → +** → *Admin SDK API* → identifier must be
`AdminDirectory` → Add.

This is what resolves group membership. The account you deploy as needs Admin
Directory read access — the same account that runs the staff directory sync.

## 4. Run setup once

In the editor, select `setupAnnouncements` and Run. Authorize when asked. It
creates `items`, `blocks`, `services`, `audit`, and `access_control`, and seeds
the next 12 Sabbaths so the form has dates on day one.

Add New Moons and Feast Days to the `services` tab by hand:

| service_date | service_type | label | reader_name | active |
|---|---|---|---|---|
| 2026-10-01 | newmoon | New Moon | | yes |
| 2026-09-23 | feast | Feast Day — Sukkot | Lawah | yes |

## 5. Deploy

**Deploy → New deployment → Web app**

- Execute as: **Me** *(required — this is what lets group checks work)*
- Who has access: **Anyone at truenation.org**

Copy the web app URL. The pages are:

```
<URL>?page=submit    the form           announcements/submit
<URL>?page=review    the dashboard      announcements/manage
<URL>?page=script    reader script      announcements/read_script
<URL>?page=home      home page embed    announcements/view_home
<URL>?page=access    permissions UI     core/access_admin
```

## 6. Create the groups

In Google Admin, create these if they do not exist:

- `announcements@truenation.org` — where new submissions are emailed
- Confirm `clerical@truenation.org` and `thycommittee@truenation.org` exist

Then open `?page=access` and confirm the announcements rows list the right
groups. Defaults ship as:

| Module | Capability | Who |
|---|---|---|
| announcements | submit | `@domain` — anyone signed in |
| announcements | manage | tn-admin, clerical, thycommittee, it |
| announcements | read_script | tn-admin, clerical, thycommittee, it |
| announcements | view_home | `@domain` |
| core | access_admin | tn-admin, it |

---

## How access control works

**One row per module + capability.** A capability is something a person can *do*,
not a page they can see — that distinction is what keeps this from turning into a
tangle later. `announcements/manage` is one capability whether it is exercised
from the dashboard, a future mobile view, or a script function.

**Unknown means denied.** `ACL.can()` returns false for any module/capability pair
with no rule. Adding a gate to new code without adding a rule fails closed.

**Super admins bypass everything.** `tn-admin@` and `it@` are hardcoded in
`AccessControl.gs` and cannot be removed from the Access page. That is deliberate
— it is the lock on the lock, so no one can accidentally lock everyone out. The
access_admin rule also refuses to be emptied.

**Membership stays in Google Groups.** Adding Lawah to the review team is a group
membership change in Google Admin. Nothing here changes, nothing redeploys.

**Caching.** Group membership is cached per user for 10 minutes, the rules table
for 5. So a change on the Access page takes up to five minutes to reach everyone,
and a new group member up to ten. Both are intentional — without caching every
page load would make several Directory API calls.

### Using it in another intranet module

Copy `AccessControl.gs` into that project, then:

```js
// gate a whole page in doGet
if (!ACL.can('calendar', 'manage')) return _denied();

// gate a single server function — always do this too, not just the page
function deleteEvent(id) {
  ACL.require('calendar', 'manage');
  ...
}

// tell the client what to show
var ctx = ACL.context('calendar');   // {email, name, can:{view:true, manage:false}}
```

Add the module's rows to `DEFAULTS` in `AccessControl.gs` (they are written to
the sheet on first run and never overwrite an existing row), or add them live
from `?page=access`.

**Gate the server functions, not just the page.** Hiding a button does not stop
anyone who knows the function name. Every function that writes calls
`ACL.require()` first.

## Troubleshooting

**Everyone gets Access Needed** — the deployment is running as the visitor
instead of you. Redeploy with *Execute as: Me*.

**A group check always fails** — the deploying account lacks Admin Directory
read access, or the Admin SDK service was not added. The code falls back to
`GroupsApp`, which only sees groups the visitor can view, so results get
inconsistent. Fix the service, do not rely on the fallback.

**Someone was added to a group but still cannot get in** — wait ten minutes, or
have them reload. Use *Check a person* on the Access page to see what the system
actually thinks.


---

## A note on private functions in Apps Script

In Apps Script a **trailing** underscore makes a function private to
`google.script.run`. A **leading** underscore does nothing at all.

This matters more than it sounds. A helper called `_setCell` is fully callable
from any signed-in member's browser console:

```js
google.script.run._setCell('items', 7, 'status', 'Approved')
```

That would walk straight past every permission check in `AccessControl.gs`.
All helpers in `Code.gs` and `Manage.gs` therefore use the trailing form —
`readTab_`, `appendRow_`, `setCell_`, `findItem_`, and so on. **If you add a
helper, put the underscore at the end.**

Two related rules that go with it:

- **Gate the server function, not just the page.** Hiding a button stops nobody
  who knows the function name. Every function that writes calls `ACL.require()`
  as its first statement.
- **Setup functions count.** `setupAnnouncements`, `seedServices` and
  `seedBlocks` are ordinary global functions and are reachable the same way, so
  they are gated too. `setupAnnouncements` makes one exception: if the
  `access_control` tab does not exist yet there is no rule to check against, so
  the very first run is allowed through. At that moment the spreadsheet is empty
  and there is nothing to take.
