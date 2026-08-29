# Staff Directory Apps Script — Manual Update Instructions

These changes live in **Google Apps Script → True Nation Staff Directory project**
and cannot be edited directly by Claude (they're not local files).
Apply the snippets below by opening that project in the Apps Script editor.

---

## 1. Code.gs — Expand `SELF_ALLOWED_COLUMNS` in `updateSelf()`

Find this block in `Code.gs`:

```javascript
var SELF_ALLOWED_COLUMNS = [
  "home_address", "phone",
  "emergency_name", "emergency_phone", "emergency_relationship",
  "ec2_name",       "ec2_phone",       "ec2_relationship"
];
```

**Replace with:**

```javascript
var SELF_ALLOWED_COLUMNS = [
  // Name & Identity
  "hebrew_first", "hebrew_last",
  "legal_first", "legal_middle", "legal_last",
  "gender", "date_of_birth",
  // Contact
  "phone", "personal_email",
  "home_address",
  "address1", "address2", "city", "state", "zip",
  // Campus
  "location",
  // Emergency Contact 1
  "emergency_name", "emergency_phone", "emergency_relationship",
  // Emergency Contact 2 (write to ec2_ columns; remove emergency_name2/phone2/relationship2 from sheet)
  "ec2_name", "ec2_phone", "ec2_relationship",
  // Skills & Ministry
  "skills", "ministry_interests",
  // Insurance
  "insurance_provider", "insurance_policy", "insurance_dependents",
];
```

That's the only change needed in `Code.gs` — the `_updateSheetRow` and `_writeUpdates`
functions already handle any column name dynamically.

---

## 2. userdirectory.html — Add Gender, Date of Birth, Campus to self-edit modal

### 2a. Add fields to the Contact tab HTML

Find the **Contact tab** in the self-edit modal. It currently ends with a
`personal-email` field. Add these three fields **after** the mobile/phone/address
block but **before** the closing `</div>` of the tab pane:

```html
<!-- Gender -->
<div class="self-form-group">
  <label for="s-gender">Gender</label>
  <select id="s-gender" class="self-input">
    <option value="">— Select —</option>
    <option value="Male">Male</option>
    <option value="Female">Female</option>
  </select>
</div>

<!-- Date of Birth -->
<div class="self-form-group">
  <label for="s-dob">Date of Birth</label>
  <input id="s-dob" type="date" class="self-input">
</div>

<!-- Campus / Location -->
<div class="self-form-group">
  <label for="s-campus">Campus</label>
  <select id="s-campus" class="self-input">
    <option value="">— Select —</option>
    <option value="Los Angeles, CA">Los Angeles, CA</option>
    <option value="Detroit, MI">Detroit, MI</option>
    <option value="Macon, GA">Macon, GA</option>
    <option value="Manila, Philippines">Manila, Philippines</option>
    <option value="Cebu, Philippines">Cebu, Philippines</option>
    <option value="Kumasi, Ghana">Kumasi, Ghana</option>
    <option value="Accra, Ghana">Accra, Ghana</option>
  </select>
</div>
```

### 2b. Pre-fill the new fields when the modal opens

Find where the modal populates existing fields on open — you'll see lines like
`document.getElementById('s-mobile').value = profile.phone || ''` (or a `setVal`
equivalent). Add these three lines alongside them:

```javascript
document.getElementById('s-gender').value = profile.gender        || '';
document.getElementById('s-dob').value    = profile.date_of_birth || '';
document.getElementById('s-campus').value = profile.location      || '';
```

> **Note:** The `profile` object comes from `getMyProfile()` — which already
> returns all sheet columns. These three fields (`gender`, `date_of_birth`,
> `location`) exist in the sheet, so they'll be present in the response
> as long as the column headers match exactly.

### 2c. Include the new fields in `saveSelf()`

The directory uses a `getVal('element-id')` helper instead of the long form
`document.getElementById('id').value.trim()`. Find the `sheetData` block in
`saveSelf()` — it looks something like:

```javascript
var sheetData = {
  home_address:  getVal('s-address'),
  phone:         getVal('s-mobile'),
  // … etc.
};
```

Add these three entries to that same `sheetData` object:

```javascript
gender:        getVal('s-gender'),
date_of_birth: getVal('s-dob'),
location:      getVal('s-campus'),
```

These map directly to the sheet columns now allowed in `SELF_ALLOWED_COLUMNS`.

---

## Summary of all changes

| File | Where | What |
|------|-------|------|
| `Code.gs` | `updateSelf()` → `SELF_ALLOWED_COLUMNS` | Expanded to 25 columns |
| `userdirectory.html` | Self-edit modal Contact tab | Added Gender select, DOB date input, Campus select |
| `userdirectory.html` | `buildSelfModal()` or modal open handler | Pre-fill gender, date_of_birth, location |
| `userdirectory.html` | `saveSelf()` → `sheetData` | Include gender, date_of_birth, location |

After making these changes, save the Apps Script project — no new deployment
needed for `Code.gs` changes (they take effect immediately on next call).
The `userdirectory.html` embed in Google Sites will reflect the modal changes
on next page load.
