# Staff Directory — Add Autofill to "Edit Selected" (Admin Only)

These changes live in **Google Apps Script → True Nation Staff Directory project**
(`userdirectory.html`) and can't be edited as a local file. Apply the snippets
below in the Apps Script editor.

**Goal:** In the admin **Edit Selected** (bulk-edit) modal, make the **Group**
and **Campus / School** fields autofill (type-ahead) instead of free text.

- **Groups** autofill from your Google Workspace groups (via the existing
  `getAllGroups()` function — no new backend needed).
- **Campus / School** autofills from the 7 fixed campuses.

No new sheet columns or fields are added — this only changes the two input
controls already in the bulk-edit modal.

> A complete, working reference implementation of everything below already
> exists in `archive/userdirectory-redesign.html`. If your live file's markup
> differs, open that file and copy the exact blocks — the IDs match these snippets.

---

## Prerequisite: confirm `getAllGroups()` exists in Code.gs

The autofill list is fed by this function. It should already be in `Code.gs`
(the redesign directory calls it). If it's missing, add:

```javascript
function getAllGroups() {
  var groups = [];
  var pageToken;
  do {
    var res = AdminDirectory.Groups.list({
      domain: 'truenation.org',
      maxResults: 200,
      pageToken: pageToken
    });
    (res.groups || []).forEach(function(g) {
      groups.push({ email: g.email, name: g.name });
    });
    pageToken = res.nextPageToken;
  } while (pageToken);
  return groups;
}
```

---

## 1. Replace the two bulk-edit fields with autocomplete versions

In `userdirectory.html`, find the **Add to Group** and **Campus / School**
rows inside the bulk-edit modal. Replace each `<input>` (or `<select>`) with the
versions below. The key additions are `list="..."` on the input and the matching
`<datalist>`.

### 1a. Group field

```html
<div class="bulk-field-row">
  <input type="checkbox" id="bf-group-on" onchange="toggleBulkField('group')">
  <div class="bulk-field-inner">
    <div class="bulk-field-label">Add to Group</div>
    <input type="text" class="bulk-field-control" id="bf-group"
           placeholder="Start typing a group name…"
           list="bf-group-list" disabled autocomplete="off">
    <datalist id="bf-group-list"></datalist>
  </div>
</div>
```

### 1b. Campus / School field

```html
<div class="bulk-field-row">
  <input type="checkbox" id="bf-building-on" onchange="toggleBulkField('building')">
  <div class="bulk-field-inner">
    <div class="bulk-field-label">Campus / School</div>
    <input type="text" class="bulk-field-control" id="bf-building"
           placeholder="Start typing a campus…"
           list="bf-building-list" disabled autocomplete="off">
    <datalist id="bf-building-list">
      <option value="Los Angeles, CA">
      <option value="Detroit, MI">
      <option value="Macon, GA">
      <option value="Manila, Philippines">
      <option value="Cebu, Philippines">
      <option value="Kumasi, Ghana">
      <option value="Accra, Ghana">
    </datalist>
  </div>
</div>
```

---

## 2. Load the group list once (if not already loaded)

If your admin init block already calls `getAllGroups()` and stores the result in
`allGroups`, skip this. Otherwise, near the top of your script add:

```javascript
var allGroups = [];
```

and inside the admin check (`.isAdmin()` success handler) add:

```javascript
google.script.run
  .withSuccessHandler(function(groups) { allGroups = groups; })
  .getAllGroups();
```

---

## 3. Fill the Group datalist when the modal opens

Find the function that opens the bulk-edit modal (e.g. `openBulkEditModal()`).
Just before it shows the modal, add:

```javascript
var grp_dl = document.getElementById('bf-group-list');
if (grp_dl && allGroups.length) {
  grp_dl.innerHTML = allGroups.map(function(g) {
    return '<option value="' + g.email + '">' + g.name + '</option>';
  }).join('');
}
```

(The Campus / School datalist is static, so it needs no JS.)

---

## That's it

Save the project. Because these are `userdirectory.html` (client) changes only,
no new deployment is required — the modal picks them up on next page load.
The user types a few letters and the browser's native autocomplete filters the
list; they can still type a value that isn't listed.

| File | Where | What |
|------|-------|------|
| `Code.gs` | `getAllGroups()` | Confirm it exists (add only if missing) |
| `userdirectory.html` | Bulk-edit modal | `Add to Group` → input + `bf-group-list` datalist |
| `userdirectory.html` | Bulk-edit modal | `Campus / School` → input + `bf-building-list` datalist |
| `userdirectory.html` | Admin init | Populate `allGroups` from `getAllGroups()` (if not already) |
| `userdirectory.html` | `openBulkEditModal()` | Fill `bf-group-list` from `allGroups` |
