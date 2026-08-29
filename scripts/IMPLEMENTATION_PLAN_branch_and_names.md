# Implementation Plan — Branch (Groups) + Names (Profile / Legal)

Status: **DRAFT for review.** No code changed yet. Snippets below are paste-in
for the Apps Script **Staff Directory** project (`Code.gs` + `userdirectory.html`),
plus edits to the local `scripts/staff-directory-sync.js`.

---

## The model (one rule)

**Google Workspace is the source of truth. The directory sheet mirrors it.**

| Concept | Source of truth in Workspace | How the sheet holds it |
|---|---|---|
| **Main name** (Hebrew if taken, else legal) | Native profile name (`name.givenName` / `familyName`) | `first` / `last` (renamed from `hebrew_first`/`hebrew_last`) — written mirror |
| **Legal name** | Custom schema `TrueNation.legal_first / legal_middle / legal_last` | `legal_first` / `legal_middle` / `legal_last` — written mirror |
| **Branch** | Google Group membership | *No column — computed live in the directory* |
| Employee ID | *left empty* — reserved for a future login challenge | n/a |

Branch groups (exact addresses to confirm):

```
bishops@truenation.org   → Bishop
apostles@truenation.org  → Apostle
deacons@truenation.org   → Deacon
(no group)               → Congregant   ← default
```

Judges branch is **removed**. Tie-break if a user is in more than one group:
**lowest rank wins** → Deacon > Apostle > Bishop.

---

## Decisions — locked vs. to confirm

**Locked (from you):**
- Plural group addresses; two-way branch↔groups; lowest-rank-wins; **drop the branch column, compute live**; Congregant = no group; **remove Judges**.
- Legal name in a **custom schema** (not Employee ID); Employee ID stays empty.
- Rename `hebrew_first`/`hebrew_last` → `first`/`last` = the main name; no separate Hebrew field.
- Existing mis-filled rows: **flag only**, no data changes now.

**To confirm before build:**
1. **Schema + field names** — proposed schema `TrueNation`, fields `legal_first`, `legal_middle`, `legal_last`. Keep **middle**? (assumed yes)
2. **Group addresses** — literally `bishops@`, `apostles@`, `deacons@truenation.org`?
3. **Legal-name self-service** — regular users generally can't patch their own Workspace custom schema. Proposal: legal name becomes **admin-managed** (edited in the directory admin modal or the Admin console), and the everyone-facing profile form no longer edits legal name. Confirm.
4. **Main-name editing from the directory** — should the admin modal be able to **rename the Google account** (patch `name`) when someone takes a Hebrew name, or is renaming a Workspace-only action with the sheet just mirroring? (Plan below treats it as Workspace-only + optional helper.)

---

# PHASE 1 — Branch ↔ Google Groups

### 1.1 `Code.gs` — constants

Replace the `BRANCHES` constant and add the group map + precedence:

```javascript
// Judges removed. Order matters ONLY for the dropdown.
var BRANCHES = ["Congregant", "Deacon", "Apostle", "Bishop"];

// Branch → Google Group email (source of truth for branch)
var BRANCH_GROUP_EMAILS = {
  Bishop:  "bishops@truenation.org",
  Apostle: "apostles@truenation.org",
  Deacon:  "deacons@truenation.org"
};

// Tie-break: lowest rank wins. Iterate low → high, first match is the branch.
var BRANCH_PRECEDENCE = ["Deacon", "Apostle", "Bishop"];
```

### 1.2 `Code.gs` — derive branch on read

Add a helper that returns an `email → branch` map by reading the three groups
once (not per user). Reuses the existing `getGroupMembers()`:

```javascript
/**
 * Returns { "user@truenation.org": "Deacon", ... } for everyone in a branch
 * group. Anyone not present is a Congregant (caller applies the default).
 * Lowest rank wins: we fill Bishop first, then Apostle, then Deacon overwrites,
 * so the lowest-ranked membership is what remains.
 */
function _computeBranchMap() {
  var map = {};
  // Fill highest → lowest so the LOWEST rank ends up as the final value.
  ["Bishop", "Apostle", "Deacon"].forEach(function(branch) {
    var groupEmail = BRANCH_GROUP_EMAILS[branch];
    try {
      getGroupMembers(groupEmail).forEach(function(em) {
        map[em.toLowerCase()] = branch;   // later (lower-rank) writes win
      });
    } catch (e) {
      Logger.log("_computeBranchMap: " + groupEmail + " → " + e.message);
    }
  });
  return map;
}
```

In **`getUsers()`**, after `gwUsers` is fetched and before/inside the `.map(...)`
that builds each result object:

```javascript
var branchMap = _computeBranchMap();   // once per getUsers call
```

and in the per-user object, replace any reliance on `sd.branch` with:

```javascript
branch: branchMap[u.primaryEmail.toLowerCase()] || "Congregant",
```

(Branch is now returned as a top-level, computed field — the frontend already
reads a branch value; point it at this instead of `sheetData.branch`.)

### 1.3 `Code.gs` — write branch by changing group membership

Add one function, then call it from both edit paths:

```javascript
/**
 * Sets a user's branch by syncing the three branch groups.
 * target = "Bishop" | "Apostle" | "Deacon" | "Congregant".
 * Congregant = remove from all three.
 */
function setUserBranch(email, target) {
  if (!isAdmin()) throw new Error("Admin access required.");
  var actor = Session.getActiveUser().getEmail();

  Object.keys(BRANCH_GROUP_EMAILS).forEach(function(branch) {
    var groupEmail = BRANCH_GROUP_EMAILS[branch];
    if (branch === target) {
      try { AdminDirectory.Members.insert({ email: email, role: "MEMBER" }, groupEmail); }
      catch (e) { /* already a member — ignore */ }
    } else {
      try { AdminDirectory.Members.remove(groupEmail, email); }
      catch (e) { /* not a member — ignore */ }
    }
  });

  _logAudit(actor, email, "branch_changed", "branch", "", target || "Congregant");
  try { CacheService.getScriptCache().remove("getUsers_result"); } catch (e) {}
}
```

**In `updateUser(email, gwData, sheetData)`** — at the top, intercept branch so it
never hits the sheet:

```javascript
if (sheetData && "branch" in sheetData) {
  setUserBranch(email, sheetData.branch);
  delete sheetData.branch;   // do NOT write branch to the sheet anymore
}
```

**In `bulkUpdateUser(email, fieldsJson)`** — replace the current
`// Branch (sheet only)` block with:

```javascript
if ("branch" in fields) {
  setUserBranch(email, fields.branch === "__CLEAR__" ? "Congregant" : fields.branch);
}
```

(Delete the `sheetPatch.branch = ...` line.)

### 1.4 `userdirectory.html` — remove Judge from the dropdowns

Two places. **Bulk modal** (`#bf-branch`): delete the Judge `<option>`. **Single
modal** (`#a-branch`) is populated from `getDropdowns().branches`, which is now
`["Congregant","Deacon","Apostle","Bishop"]` — no HTML change needed there, it
follows the constant automatically.

### 1.5 Drop the `branch` column

- **Sheet:** delete the `branch` column from the `data` tab (and `Former Staff`
  if present). ⚠️ Verify nothing else references it first — see Phase 3.
- **Sync:** `staff-directory-sync.js` never writes branch, so no change there.
- **Note:** because branch is now computed only inside the directory app, the raw
  sheet / AppSheet will **not** show branch. If any AppSheet view or sheet formula
  needs branch, tell me — the sync can instead write a computed `branch` mirror
  column (2 calls/day). Default per your decision: compute live, no column.

---

# PHASE 2 — Names (Main name + Legal name)

### 2.1 Rename sheet columns

In the `data` tab header row: `hebrew_first → first`, `hebrew_last → last`.
(Spouse columns `spouse_hebrew_first`/`_last` are separate — leave them.)

### 2.2 Create the custom schema (one-time)

Run once from the Apps Script editor (or create the same fields in Admin console
→ Directory → Users → *Manage custom attributes*):

```javascript
function createLegalNameSchema() {
  AdminDirectory.Schemas.insert({
    schemaName: "TrueNation",
    displayName: "True Nation",
    fields: [
      { fieldName: "legal_first",  fieldType: "STRING", displayName: "Legal First",  readAccessType: "ADMINS_AND_SELF" },
      { fieldName: "legal_middle", fieldType: "STRING", displayName: "Legal Middle", readAccessType: "ADMINS_AND_SELF" },
      { fieldName: "legal_last",   fieldType: "STRING", displayName: "Legal Last",   readAccessType: "ADMINS_AND_SELF" }
    ]
  }, "my_customer");
}
```

### 2.3 `getUsers()` — read custom schema + main name

- Change the list options from `projection: "basic"` to **`projection: "full"`**
  (basic omits custom schemas). Keep `viewType: "admin_view"`.
- Per user, expose main name and legal name:

```javascript
var cs = (u.customSchemas && u.customSchemas.TrueNation) || {};
// ...
first:       (u.name && u.name.givenName)  || "",
last:        (u.name && u.name.familyName) || "",
legal_first: cs.legal_first  || "",
legal_middle:cs.legal_middle || "",
legal_last:  cs.legal_last   || "",
```

The displayed name already uses `u.name.fullName` — unchanged. The admin modal
should read legal name from these fields instead of `sheetData.legal_*`.

### 2.4 Write legal name → schema

**In `updateUser()`** — intercept the legal fields, patch the schema, and keep a
sheet mirror:

```javascript
var legalKeys = ["legal_first", "legal_middle", "legal_last"];
var legalPatch = {};
legalKeys.forEach(function(k) {
  if (sheetData && k in sheetData) legalPatch[k] = sheetData[k];  // stays in sheetData → mirrors to sheet
});
if (Object.keys(legalPatch).length) {
  AdminDirectory.Users.patch({ customSchemas: { TrueNation: legalPatch } }, email);
}
// sheetData still contains legal_* → _updateSheetRow writes the mirror. OK.
```

Deletion: an empty string clears both the schema value and the mirror.

### 2.5 `staff-directory-sync.js` — mirror, stop polluting legal

Current bug: it writes GW name into `legal_first`/`legal_last`. New behavior:

- **Main name → mirror (overwrite):** write GW `givenName`/`familyName` into
  `first`/`last` every run (it's a mirror of the account, so overwrite, don't
  fill-if-blank).
- **Legal name → mirror (overwrite):** read `user.customSchemas.TrueNation` (the
  sync already uses `projection: "full"`) and write into `legal_first` /
  `legal_middle` / `legal_last`.
- **Stop** filling `legal_first`/`legal_last` from the profile name.

Config changes:

```javascript
COL_FIRST: "first",
COL_LAST:  "last",
COL_LEGAL_FIRST:  "legal_first",
COL_LEGAL_MIDDLE: "legal_middle",
COL_LEGAL_LAST:   "legal_last",
```

Per-user write (replace the `_fillIfBlank_` name lines):

```javascript
var cs = (user.customSchemas && user.customSchemas.TrueNation) || {};
_setCell_(sheet, row, H[CONFIG.COL_FIRST],        firstName);          // overwrite mirror
_setCell_(sheet, row, H[CONFIG.COL_LAST],         lastName);
_setCell_(sheet, row, H[CONFIG.COL_LEGAL_FIRST],  cs.legal_first  || "");
_setCell_(sheet, row, H[CONFIG.COL_LEGAL_MIDDLE], cs.legal_middle || "");
_setCell_(sheet, row, H[CONFIG.COL_LEGAL_LAST],   cs.legal_last   || "");
```

with a small overwrite helper:

```javascript
function _setCell_(sheet, row, colIdx, value) {
  if (!colIdx) return;
  sheet.getRange(row, colIdx).setValue(value);
}
```

(`firstName`/`lastName` here are `user.name.givenName`/`familyName`, already read.)

### 2.6 Downstream references to update

Grep and update in the Apps Script project + local files:

- `saveProfile(data)` in `Code.gs`: it maps `data.hebrewFirst → hebrew_first` and
  `data.legalFirst → legal_first`. Repoint the Hebrew mapping to `first`/`last`,
  and route legal name to the schema (or drop from self-service — decision #3).
- `profilesetup.html` / `profilesetup_desktop` / `profile-editor-ui.html`: remove
  or relabel the "Hebrew" name inputs (there's no Hebrew field anymore) and the
  legal-name inputs per decision #3.
- The earlier relabel ("First/Middle/Last" in the everyone form) — if legal name
  leaves self-service, those inputs go away; revisit then.

---

# PHASE 3 — Verification (do this before + after)

**Before deleting the branch column**, confirm nothing depends on it:
- Search `userdirectory.html`, `profile-editor*.html`, dashboard embeds, and any
  AppSheet columns/formulas for `branch`.
- Confirm the three group emails resolve (run `getGroupMembers('deacons@truenation.org')`).

**After changes — test matrix:**
1. Admin sets a member to Deacon in the directory → member appears in
   `deacons@` group in Admin console; directory shows "Deacon" on reload.
2. Admin removes a member from `bishops@` in the Admin console → directory shows
   "Congregant" (or next-lowest group) on reload.
3. Member in two groups → shows the lowest rank (Deacon).
4. Edit legal name in the directory → value appears under the user's custom
   attributes in Admin console **and** in the sheet's `legal_*` columns.
5. Edit legal name in the Admin console → directory + sheet reflect it after sync.
6. Rename a Google account's profile name → directory display + sheet `first`/
   `last` update after sync; legal name untouched.
7. Employee ID field remains empty on all accounts.

**Rollout order:** (1) create schema → (2) `Code.gs` constants + branch functions
→ (3) `getUsers` projection/derivation → (4) write paths → (5) `userdirectory.html`
dropdown → (6) rename sheet columns → (7) update sync → (8) drop branch column
→ (9) run test matrix.

---

## Open confirmations (repeat of the four above)
1. Schema/field names + keep middle name?
2. Exact group addresses?
3. Legal name = admin-managed (out of self-service)?
4. Should the directory be able to rename the Google account, or Workspace-only?
