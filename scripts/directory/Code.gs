// ═══════════════════════════════════════════════════════════════════════════
// TRUE NATION STAFF DIRECTORY — Google Apps Script Backend  (Code.gs)
// ═══════════════════════════════════════════════════════════════════════════
//
// One deployment, gated to @truenation.org, serves everything via doGet:
//   (default)             → userdirectory.html   (staff directory)
//   ?page=profilesetup    → profilesetup(.desktop).html
//   ?page=hub             → Hub.html   (Member Hub)
//   ?page=alms            → Alms.html  (Commitment of Alms)
//
// The Member Hub / Alms pages are plain self-contained HTML templates (no
// external runtime). saveAlmsCommitment() below records a member's pledge on
// their own staff-sheet row, reusing the same sheet helpers as saveProfile().

// ── Constants ────────────────────────────────────────────────────────────────

var SHEET_ID        = "1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk";
var DRIVE_FOLDER_ID = "1oXTjNqtgenlOgA8t1t_y2365aDaEJsRG";
var DOMAIN          = "truenation.org";
var ADMIN_EMAIL     = "tn-admin@truenation.org";
var ADMIN_GROUP     = "tn-admin@truenation.org";

// The Member Hub / Alms logo is reused from the profilesetup page's inline logo
// (see getLogoDataUri_) — one source of truth, nothing hosted outside Workspace.

var BRANCHES         = ["Congregant", "Deacon", "Apostle", "Judge", "Bishop"];
var COST_CENTERS     = ["General", "Youth Ministry", "Worship Arts", "Outreach", "Administration", "Operations"];
var EMPLOYMENT_TYPES = ["Volunteer", "Part-Time", "Full-Time", "Contractor", "Intern"];

// Columns added by Stage 2 that may not yet exist in the sheet
var EXTRA_COLS = ['ins_group', 'medical_conditions', 'occupation', 'circumcised', 'sons_circumcised',
                 'address1', 'address2', 'city', 'state', 'zip'];


// ── Entry Point ───────────────────────────────────────────────────────────────

/**
 * Serves the correct HTML file based on the `page` query parameter.
 *   ?page=profilesetup  →  profilesetup.html
 *   ?page=hub           →  Hub.html   (Member Hub)
 *   ?page=alms          →  Alms.html  (Commitment of Alms)
 *   (anything else)     →  index.html  (staff directory)
 */
function doGet(e) {
  var page      = e && e.parameter && e.parameter.page;
  var userAgent = (e && e.parameter && e.parameter.userAgent) || '';

  // Detect mobile/tablet from user-agent
  // GAS doesn't expose request headers directly, so we check a 'ua' param
  // injected by a small redirect page, OR fall back to the ?mobile= override param.
  var forceMobile  = e && e.parameter && e.parameter.mobile === '1';
  var forceDesktop = e && e.parameter && e.parameter.mobile === '0';
  // Default to mobile — most staff access on phones.
  // Desktop only when ?mobile=0 is explicitly set.
  var isMobile     = !forceDesktop;

  if (page === 'profilesetup_router') {
    return HtmlService.createHtmlOutputFromFile('profilesetup_router')
      .setTitle('True Nation — Profile Setup')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === 'profilesetup') {
    // Route to mobile or desktop profile setup
    var template = isMobile ? 'profilesetup' : 'profilesetup_desktop';
    var tmpl = HtmlService.createTemplateFromFile(template);
    tmpl.mapsApiKey = PropertiesService.getScriptProperties().getProperty('MAPS_API_KEY') || '';
    return tmpl.evaluate()
      .setTitle('True Nation — Complete Your Profile')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Member-facing pages (Member Hub + Commitment of Alms).
  // Both are plain HTML templates; we inject the member's first name, the asset
  // origin, and this web app's own URL (used for the page-to-page links).
  if (page === 'hub' || page === 'alms') {
    var memberFile = (page === 'alms') ? 'Alms' : 'Hub';
    var mtmpl = HtmlService.createTemplateFromFile(memberFile);
    mtmpl.memberName = getMemberFirstName_();
    mtmpl.selfUrl    = ScriptApp.getService().getUrl();
    mtmpl.logo       = getLogoDataUri_();  // real TN logo, base64-inlined at serve time
    return mtmpl.evaluate()
      .setTitle(page === 'alms' ? 'True Nation — Commitment of Alms' : 'True Nation — Member Hub')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Must use createTemplateFromFile (not createHtmlOutputFromFile) so that
  // <?!= include('brand-styles') ?> scriptlets are evaluated before serving.
  return HtmlService.createTemplateFromFile('userdirectory').evaluate()
    .setTitle('True Nation Staff Directory')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Returns true if the user-agent string looks like a mobile or tablet device.
 * Called by doGet when a ?userAgent= param is present (injected by the
 * profilesetup_router.html shim), or when ?mobile=1 is manually appended.
 */
function isMobileUA_(ua) {
  if (!ua) return false;
  return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
}

/**
 * Includes the raw HTML content of another GAS HTML file.
 * Used via <?!= include('brand-styles') ?> in templates.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// ── Session helpers ───────────────────────────────────────────────────────────

function getCurrentUser() {
  return Session.getActiveUser().getEmail();
}

/**
 * First name for the Member Hub / Alms greeting, derived from the signed-in
 * Workspace email (e.g. shahad.ahmath@ → "Shahad"). Falls back to "Family".
 */
function getMemberFirstName_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) return 'Family';
  var local = email.split('@')[0].replace(/[._]+/g, ' ').trim();
  if (!local) return 'Family';
  return local.charAt(0).toUpperCase() + local.slice(1).split(' ')[0];
}

/**
 * The True Nation logo as a base64 data URI for the Member Hub / Alms pages.
 * Pulled from the profilesetup HTML file, where the logo already lives inline —
 * one source of truth, nothing hosted outside Workspace. Cached 6h. Returns ''
 * if it can't be found (the pages then show the "True Nation" alt text).
 */
function getLogoDataUri_() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('tn_logo_datauri');
  if (cached) return cached;

  var uri = '';
  try {
    var html = HtmlService.createHtmlOutputFromFile('profilesetup').getContent();
    var m = html.match(/data:image\/png;base64,[A-Za-z0-9+\/=]+/);
    if (m) uri = m[0];
  } catch (e) {
    Logger.log('getLogoDataUri_: ' + e.message);
  }

  if (uri && uri.length < 100000) {
    try { cache.put('tn_logo_datauri', uri, 21600); } catch (e) {}
  }
  return uri;
}

/**
 * Returns true if the current user is a member of the admin Google Group.
 * Result is cached for 5 minutes to avoid excessive API calls.
 */
function isAdmin() {
  var email = Session.getActiveUser().getEmail();
  var cache = CacheService.getUserCache();
  var cached = cache.get('isAdmin');
  if (cached !== null) return cached === 'true';
  var result = false;
  try {
    AdminDirectory.Members.get(ADMIN_GROUP, email);
    result = true;
  } catch (e) {
    result = false;
  }
  cache.put('isAdmin', String(result), 300);
  return result;
}

function getLogoutUrl() {
  return "https://accounts.google.com/Logout?continue="
    + encodeURIComponent(ScriptApp.getService().getUrl());
}

function getDropdowns() {
  return {
    branches:        BRANCHES,
    costCenters:     COST_CENTERS,
    employmentTypes: EMPLOYMENT_TYPES
  };
}

/**
 * Returns the Google Maps API key from Script Properties.
 *
 * NOT guarded, deliberately. An isAdmin() guard was added here on 2026-09-03 and
 * reverted the same day: profilesetup.html calls this function from the client to
 * load the Maps script, so the guard broke address autocomplete for every
 * non-admin member — the exact people the profile form exists for.
 *
 * Do NOT re-add the guard. Note that an earlier version of this comment claimed
 * the guard "bought nothing" because doGet() publishes the key anyway. That was
 * wrong: doGet() sets tmpl.mapsApiKey, but neither profilesetup template ever
 * reads it, so this function is in fact the only path to the key. The guard did
 * restrict access - it also broke the feature, which is the real reason it went.
 *
 * The controls that actually cap the exposure are all Cloud-side: per-API quota
 * caps, a billing budget with alerts, and an API restriction limiting the key to
 * Maps JavaScript + Places. An HTTP referrer restriction is impractical here
 * because Apps Script serves these pages from a randomized
 * *.googleusercontent.com sandbox origin.
 */
function getMapsApiKey() {
  return PropertiesService.getScriptProperties().getProperty('MAPS_API_KEY') || null;
}

function lookupTNUser(email) { return lookupMember(email); }

function lookupMember(email) {
  try {
    var user = AdminDirectory.Users.get(email, { projection: 'basic' });
    return { name: user.name.fullName };
  } catch (e) {
    return null;
  }
}


// ── Sheet helpers (private) ───────────────────────────────────────────────────

function getStaffSheet_() {
  return SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
}

function readSheet_() {
  var sheet = getStaffSheet_();
  var data  = sheet.getDataRange().getValues();
  if (!data || data.length === 0) return { headers: [], rows: [] };
  var headers = data[0].map(String);
  var rows    = data.slice(1).map(function(r) {
    while (r.length < headers.length) r.push("");
    return r.map(String);
  });
  return { headers: headers, rows: rows };
}

/**
 * Ensures all columns in `wanted` exist in the header row.
 * Appends any missing columns and returns the final header array.
 */
function ensureColumns_(sheet, headers, wanted) {
  var missing = wanted.filter(function(c) { return headers.indexOf(c) === -1; });
  if (missing.length === 0) return headers;
  var updated = headers.concat(missing);
  sheet.getRange(1, 1, 1, updated.length).setValues([updated]);
  return updated;
}

/**
 * Writes a partial data map to the row for `email`.
 * If no row exists for the email, appends a new one.
 */
function updateSheetRow_(email, dataMap) {
  var sheet   = getStaffSheet_();
  var result  = readSheet_();
  var headers = result.headers;
  var rows    = result.rows;

  headers = ensureColumns_(sheet, headers, Object.keys(dataMap));

  var emailCol = headers.indexOf("email");
  var rowIdx   = -1;
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][emailCol] || "") === email) { rowIdx = i; break; }
  }

  if (rowIdx === -1) {
    var newRow = headers.map(function(h) {
      if (h === "email") return email;
      return dataMap[h] !== undefined ? dataMap[h] : "";
    });
    sheet.appendRow(newRow);
  } else {
    var existingRow = rows[rowIdx];
    var updatedRow  = headers.map(function(h, i) {
      if (dataMap[h] !== undefined) return dataMap[h];
      return existingRow[i] !== undefined ? existingRow[i] : "";
    });
    var sheetRow = rowIdx + 2;
    sheet.getRange(sheetRow, 1, 1, updatedRow.length).setValues([updatedRow]);
  }
}

/**
 * Writes only non-null, non-empty values — preserves existing data.
 * Used by saveProfile for targeted cell-by-cell writes.
 */
function writeUpdates_(sheet, rowNum, headers, updates) {
  Object.keys(updates).forEach(function(key) {
    var val = updates[key];
    if (val === null || val === undefined || val === '') return;
    var col = headers.indexOf(key);
    if (col < 0) return;
    sheet.getRange(rowNum, col + 1).setValue(val);
  });
}

/** Writes family_id to spouse's row only if the spouse exists and their family_id is blank. */
function linkSpouse_(sheet, spouseEmail, familyId) {
  var vals = sheet.getDataRange().getValues();
  var h    = vals[0];
  var eIdx = h.indexOf('email'), fIdx = h.indexOf('family_id');
  if (eIdx < 0 || fIdx < 0) return;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][eIdx] === spouseEmail && !vals[i][fIdx]) {
      sheet.getRange(i + 1, fIdx + 1).setValue(familyId);
      return;
    }
  }
}

/**
 * Deterministic family_id: MD5 of sorted email pair → first 12 hex chars.
 * Both spouses always produce the same ID regardless of who submits first.
 */
function familyId_(emailA, emailB) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    [emailA, emailB].sort().join('|')
  );
  return bytes.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('').slice(0, 12);
}

/** Uploads a base64 data URL to the secure Drive folder, returns the file URL. */
function uploadToDrive_(dataUrl, filename) {
  if (!dataUrl) return null;
  Logger.log('uploadToDrive_: filename=' + filename + ' dataUrl length=' + dataUrl.length);
  var match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) { Logger.log('uploadToDrive_: bad dataUrl format'); return null; }
  var mimeType = match[1];
  var b64      = match[2];
  Logger.log('uploadToDrive_: mimeType=' + mimeType + ' b64 length=' + b64.length);
  var decoded  = Utilities.base64Decode(b64);
  Logger.log('uploadToDrive_: decoded bytes=' + decoded.length);
  var blob     = Utilities.newBlob(decoded, mimeType, filename);
  Logger.log('uploadToDrive_: blob created');
  var folderId = PropertiesService.getScriptProperties().getProperty('SECURE_ID_FOLDER_ID');
  Logger.log('uploadToDrive_: folderId=' + folderId);
  var file;
  if (!folderId) {
    Logger.log('WARNING: SECURE_ID_FOLDER_ID not set, uploading to root Drive');
    file = DriveApp.createFile(blob);
  } else {
    file = DriveApp.getFolderById(folderId).createFile(blob);
  }
  Logger.log('uploadToDrive_: file created id=' + file.getId());
  try {
    file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);
    Logger.log('uploadToDrive_: sharing set');
  } catch(e) {
    Logger.log('uploadToDrive_: setSharing failed (non-fatal): ' + e.message);
  }
  return file.getUrl();
}

/** Uploads a base64 data URL as the user's Admin Directory profile photo. */
function uploadPhoto_(email, dataUrl) {
  if (!dataUrl) return;
  try {
    var match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return;
    var mimeType  = match[1] || 'image/jpeg';
    var photoData = match[2].replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (!photoData) return;
    AdminDirectory.Users.Photos.update({ photoData: photoData, mimeType: mimeType, primaryEmail: email, kind: 'admin#directory#userPhoto' }, email);
  } catch (e) {
    Logger.log('Photo upload failed for ' + email + ': ' + e.message);
  }
}


// ── Profile Setup (Stage 2) ───────────────────────────────────────────────────

/**
 * Saves the extended profile submitted from profilesetup.html.
 * Writes all fields to the user's sheet row, uploads files,
 * links spouse family_id, and notifies tn-admin@truenation.org.
 */
function saveProfile(data) {
  Logger.log('saveProfile: start for ' + Session.getActiveUser().getEmail());
  var email = Session.getActiveUser().getEmail();
  if (!email || !email.endsWith('@' + DOMAIN)) {
    throw new Error('You must be signed in with a truenation.org account.');
  }

  Logger.log('saveProfile: reading sheet');
  var sheet   = getStaffSheet_();
  var result  = readSheet_();
  var headers = ensureColumns_(sheet, result.headers, EXTRA_COLS);
  var rows    = result.rows;

  var emailCol = headers.indexOf('email');
  var userRow  = -1;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][emailCol] === email) { userRow = i + 2; break; }
  }
  Logger.log('saveProfile: userRow=' + userRow);
  if (userRow < 0) {
    // User exists in GW but has no sheet row (added outside onboarding).
    // Create a minimal row so saveProfile can proceed.
    Logger.log('saveProfile: no row found for ' + email + ' — creating one');
    var newRow = new Array(headers.length).fill('');
    newRow[emailCol] = email;
    var onboardingCol = headers.indexOf('onboarding_date');
    if (onboardingCol >= 0) newRow[onboardingCol] = new Date().toISOString();
    sheet.appendRow(newRow);
    userRow = sheet.getLastRow();
    Logger.log('saveProfile: created row at ' + userRow);
    logAudit_(email, email, 'profile_row_created', 'email', '', email);
  }

  Logger.log('saveProfile: uploading files');
  var idFrontUrl = null, idBackUrl = null;
  try {
    idFrontUrl = data.idFrontDataUrl ? uploadToDrive_(data.idFrontDataUrl, 'id_front_' + email) : null;
    idBackUrl  = data.idBackDataUrl  ? uploadToDrive_(data.idBackDataUrl,  'id_back_'  + email) : null;
  } catch (e) {
    Logger.log('saveProfile: ID upload failed (non-fatal): ' + e.message);
  }

  if (data.photoDataUrl) uploadPhoto_(email, data.photoDataUrl);

  Logger.log('saveProfile: building updates map');
  var familyMembers = null;
  // Support both new spouses[] array and legacy single-spouse fields
  var spouses  = data.spouses  || [];
  var children = data.children || [];
  var allMembers = [];

  children.forEach(function(ch) {
    allMembers.push({ role: 'child', govFirst: ch.govFirst||'', govLast: ch.govLast||'',
                      hebFirst: ch.hebFirst||'', hebLast: ch.hebLast||'', tnEmail: ch.tnEmail||'' });
  });
  spouses.slice(1).forEach(function(sp) {
    allMembers.push({ role: 'spouse', govFirst: sp.govFirst||'', govLast: sp.govLast||'',
                      hebFirst: sp.hebFirst||'', hebLast: sp.hebLast||'', tnEmail: sp.tnEmail||'' });
  });
  if (allMembers.length) {
    try { familyMembers = JSON.stringify(allMembers); } catch(e) {}
  }

  var primarySpouse = spouses.length > 0 ? spouses[0] : null;
  var spouseTnEmail  = primarySpouse ? primarySpouse.tnEmail  : (data.spouseTnEmail  || '');
  var spouseGovFirst = primarySpouse ? primarySpouse.govFirst : (data.spouseGovFirst || '');
  var spouseGovLast  = primarySpouse ? primarySpouse.govLast  : (data.spouseGovLast  || '');
  var spouseHebFirst = primarySpouse ? primarySpouse.hebFirst : (data.spouseHebFirst || '');
  var spouseHebLast  = primarySpouse ? primarySpouse.hebLast  : (data.spouseHebLast  || '');

  function s(v) { return (v === undefined || v === null) ? null : String(v); }

  var updates = {
    home_address:            s(data.homeAddress),
    address1:                s(data.address1),
    address2:                s(data.address2),
    city:                    s(data.city),
    state:                   s(data.state),
    zip:                     s(data.zip),
    date_of_birth:           s(data.dateOfBirth),
    gender:                  s(data.gender),
    location:                s(data.location),
    occupation:              s(data.occupation),
    legal_first:             s(data.legalFirst),
    legal_middle:            s(data.legalMiddle),
    legal_last:              s(data.legalLast),
    hebrew_first:            s(data.hebrewFirst),
    hebrew_last:             s(data.hebrewLast),
    spouse_email:            s(spouseTnEmail),
    spouse_legal_first:      s(spouseGovFirst),
    spouse_legal_last:       s(spouseGovLast),
    spouse_hebrew_first:     s(spouseHebFirst),
    spouse_hebrew_last:      s(spouseHebLast),
    family_members:          familyMembers,
    insurance_provider:      s(data.insProvider),
    insurance_policy:        s(data.insSubscriberId),
    ins_group:               s(data.insGroup),
    medical_conditions:      s(data.medicalConditions),
    circumcised:             s(data.circumcised),
    sons_circumcised:        s(data.sonsCircumcised),
    emergency_name:          s(data.ec1Name),
    emergency_phone:         s(data.ec1Phone),
    emergency_relationship:  s(data.ec1Relationship),
    ec2_name:                s(data.ec2Name),
    ec2_phone:               s(data.ec2Phone),
    ec2_relationship:        s(data.ec2Relationship),
    id_front_url:            idFrontUrl,
    id_back_url:             idBackUrl,
    skills:                  s(data.skills),
    ministry_interests:      s(data.ministryInterests),
    profile_complete_date:   new Date().toISOString()
  };

  if (spouseTnEmail) {
    Logger.log('saveProfile: linking spouse ' + spouseTnEmail);
    try {
      var fid = familyId_(email, spouseTnEmail);
      updates.family_id = fid;
      linkSpouse_(sheet, spouseTnEmail, fid);
    } catch(e) { Logger.log('saveProfile: spouse link failed: ' + e.message); }
  }

  Logger.log('saveProfile: writing updates to row ' + userRow);

  // ── Audit: capture before-state, write, then log changed fields ──
  var beforeValues = {};
  var userRowData  = sheet.getRange(userRow, 1, 1, headers.length).getValues()[0];
  headers.forEach(function(h, i) { beforeValues[h] = userRowData[i]; });

  writeUpdates_(sheet, userRow, headers, updates);
  Logger.log('saveProfile: write complete');

  // Log each field that actually changed
  var changedFields = [];
  Object.keys(updates).forEach(function(field) {
    var newVal = updates[field];
    if (newVal === null || newVal === undefined) return;
    var oldVal = String(beforeValues[field] || '');
    var nVal   = String(newVal);
    if (oldVal !== nVal) {
      changedFields.push(field);
      logAudit_(email, email, 'profile_field_updated', field, oldVal || '(empty)', nVal || '(empty)');
    }
  });

  if (data.photoDataUrl) {
    logAudit_(email, email, 'profile_field_updated', 'profile_photo', '', 'updated');
  }
  if (idFrontUrl) {
    logAudit_(email, email, 'profile_field_updated', 'id_front', '', 'uploaded');
  }
  if (idBackUrl) {
    logAudit_(email, email, 'profile_field_updated', 'id_back', '', 'uploaded');
  }

  logAudit_(email, email, 'profile_setup_completed', '', '', changedFields.length + ' field(s): ' + (changedFields.join(', ') || 'none'));


  // Bust the getUsers cache so next load reflects changes
  try { CacheService.getScriptCache().remove('getUsers_result'); } catch(e) {}

  try {
    var subject = '=?UTF-8?B?' + Utilities.base64Encode('Profile Complete: ' + email) + '?=';
    var body    = email + ' has completed their profile setup.';
    GmailApp.sendEmail(ADMIN_EMAIL, subject, body);
    // Also send directly to the script-running admin account so it lands in inbox
    var adminInbox = Session.getEffectiveUser().getEmail();
    if (adminInbox && adminInbox !== ADMIN_EMAIL) {
      GmailApp.sendEmail(adminInbox, subject, body);
    }
    Logger.log('saveProfile: admin email sent');
  } catch (e) {
    Logger.log('saveProfile: admin email failed: ' + e.message);
  }

  Logger.log('saveProfile: done');
}


// ── Commitment of Alms ────────────────────────────────────────────────────────

/**
 * Records a member's monthly-alms commitment on their OWN staff-sheet row.
 * Called from Alms.html via google.script.run.saveAlmsCommitment(payload).
 * The signed-in member's email is read server-side, so it cannot be spoofed.
 *
 * payload = { name, date, agreed, signature (PNG data URL), source, submittedAt }
 * Returns { ok, email, row } to the page's success handler.
 */
function saveAlmsCommitment(payload) {
  var email = Session.getActiveUser().getEmail();
  if (!email || !email.endsWith('@' + DOMAIN)) {
    throw new Error('You must be signed in with a truenation.org account.');
  }
  if (!payload || !payload.agreed) throw new Error('Commitment was not affirmed.');

  // Snake_case columns, consistent with the rest of the staff sheet.
  var ALMS_COLS = ['alms_committed', 'alms_commitment_date', 'alms_signature_url', 'alms_signed_at', 'alms_signed_name'];

  var sheet   = getStaffSheet_();
  var result  = readSheet_();
  var headers = ensureColumns_(sheet, result.headers, ALMS_COLS);
  var rows    = result.rows;

  var emailCol = headers.indexOf('email');
  if (emailCol === -1) throw new Error('Staff sheet is missing an "email" column.');

  // Find the member's row (case-insensitive); create a minimal one if absent.
  var target  = String(email).trim().toLowerCase();
  var userRow = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][emailCol] || '').trim().toLowerCase() === target) { userRow = i + 2; break; }
  }
  if (userRow < 0) {
    var newRow = new Array(headers.length).fill('');
    newRow[emailCol] = email;
    sheet.appendRow(newRow);
    userRow = sheet.getLastRow();
    logAudit_(email, email, 'profile_row_created', 'email', '', email);
  }

  // Save the signature PNG to the secure Drive folder (domain-view sharing).
  var sigUrl = '';
  if (payload.signature) {
    try {
      sigUrl = uploadToDrive_(payload.signature, 'alms_signature_' + email) || '';
    } catch (e) {
      Logger.log('saveAlmsCommitment: signature upload failed (non-fatal): ' + e.message);
    }
  }

  writeUpdates_(sheet, userRow, headers, {
    alms_committed:       'Yes',
    alms_commitment_date: payload.date || '',
    alms_signature_url:   sigUrl,
    alms_signed_at:       payload.submittedAt || new Date().toISOString(),
    alms_signed_name:     payload.name || ''
  });

  logAudit_(email, email, 'alms_committed', 'alms_committed', '', 'Yes');

  // Bust the getUsers cache so the directory reflects the new commitment.
  try { CacheService.getScriptCache().remove('getUsers_result'); } catch (e) {}

  try {
    var subject = '=?UTF-8?B?' + Utilities.base64Encode('Alms Commitment: ' + email) + '?=';
    GmailApp.sendEmail(ADMIN_EMAIL, subject, email + ' has signed their commitment of alms.');
  } catch (e) {
    Logger.log('saveAlmsCommitment: admin email failed: ' + e.message);
  }

  return { ok: true, email: email, row: userRow };
}


// ── Audit Log (private) ───────────────────────────────────────────────────────

function getAuditSheet_() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var audit = ss.getSheetByName("Audit Log");
  if (!audit) {
    audit = ss.insertSheet("Audit Log");
  }
  // Always ensure headers exist on row 1
  var firstRow = audit.getRange(1, 1, 1, 7).getValues()[0];
  if (!firstRow[0] || String(firstRow[0]).toLowerCase() !== "timestamp") {
    audit.getRange(1, 1, 1, 7).setValues([["timestamp", "actor", "target_email", "action", "field", "old_value", "new_value"]]);
    audit.setFrozenRows(1);
  }
  return audit;
}

function logAudit_(actor, targetEmail, action, field, oldValue, newValue) {
  try {
    var sheet = getAuditSheet_();
    sheet.appendRow([
      new Date().toISOString(),
      actor       || "",
      targetEmail || "",
      action      || "",
      field       || "",
      oldValue    || "",
      newValue    || ""
    ]);
    Logger.log("Audit logged: " + action + " for " + targetEmail + " by " + actor);
  } catch (e) {
    // Log full error so it shows in Apps Script Executions dashboard
    Logger.log("AUDIT LOG FAILED: " + e.message + " stack: " + e.stack);
  }
}

/**
 * Run this from the Apps Script editor to test the full audit pipeline:
 * 1. Creates/verifies the Audit Log sheet
 * 2. Writes a test entry
 * 3. Reads it back and logs the result
 * Check Apps Script Executions / Logs after running.
 */
function testAuditLog() {
  var me = Session.getActiveUser().getEmail();
  Logger.log("testAuditLog: running as " + me);
  try {
    var sheet = getAuditSheet_();
    Logger.log("testAuditLog: sheet found/created: " + sheet.getName() + " rows=" + sheet.getLastRow());
    logAudit_(me, me, "audit_test", "test_field", "before", "after");
    Logger.log("testAuditLog: write succeeded");
    var entries = getAuditLog(me);
    Logger.log("testAuditLog: read back " + entries.length + " entries for " + me);
    if (entries.length) Logger.log("testAuditLog: latest = " + JSON.stringify(entries[0]));
  } catch(e) {
    Logger.log("testAuditLog FAILED: " + e.message + " | " + e.stack);
  }
}

function initAuditLog() {
  var sheet = getAuditSheet_();
  Logger.log("Audit Log sheet ready: " + sheet.getName());
  return "Audit Log initialized";
}


// ── Directory — read ──────────────────────────────────────────────────────────


/**
 * Fetches a user's profile photo from Admin Directory and returns it as a base64 data URL.
 * Returns null if the user has no photo.
 */
function getPhotoDataUrl_(email) {
  // Strategy 1: Admin Directory Photos API
  try {
    var photo = AdminDirectory.Users.Photos.get(email);
    if (photo && photo.photoData) {
      var b64 = photo.photoData.replace(/-/g, '+').replace(/_/g, '/');
      var mimeType = photo.mimeType || 'image/jpeg';
      return 'data:' + mimeType + ';base64,' + b64;
    }
  } catch(e) { /* no admin photo — fall through */ }

  // Strategy 2: Fetch thumbnailPhotoUrl bytes server-side with OAuth token
  try {
    var user = AdminDirectory.Users.get(email, { projection: 'basic' });
    var thumbUrl = user && user.thumbnailPhotoUrl;
    if (!thumbUrl) return null;
    var token = ScriptApp.getOAuthToken();
    var resp = UrlFetchApp.fetch(thumbUrl, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      Logger.log('getPhotoDataUrl_ fetch status ' + resp.getResponseCode() + ' for ' + email);
      return null;
    }
    var bytes = resp.getContent();
    var b64 = Utilities.base64Encode(bytes);
    var ct   = (resp.getHeaders()['Content-Type'] || 'image/jpeg').split(';')[0];
    return 'data:' + ct + ';base64,' + b64;
  } catch(e) {
    Logger.log('getPhotoDataUrl_ fallback failed for ' + email + ': ' + e.message);
    return null;
  }
}


/**
 * Returns a base64 data URL for the current user's profile photo.
 * Called once when the self-edit modal opens — avoids fetching for all users.
 */
function getSelfPhoto() {
  var email = Session.getActiveUser().getEmail();
  return getPhotoDataUrl_(email);
}
// ── Directory — read (access-filtered) ────────────────────────────────────────

/**
 * Sheet columns any signed-in member may see about ANY OTHER member.
 * Anything not listed here is admin-only. A member always sees their own row
 * in full, and admins always see every row in full.
 *
 * Deliberately excluded: date_of_birth (see birthdayOnly_ below), home_address,
 * legal_first/middle/last, gender is included, emergency_*, ec2_*, insurance_*,
 * notes, id_front_url, id_back_url, cost_center, start_date, employment_type,
 * family_id, spouse_legal_*, profile_complete_date.
 */
var MEMBER_VISIBLE_SHEET_FIELDS = [
  "branch",
  "gender",
  "location",
  "phone",
  "skills",
  "ministry_interests"
];

/**
 * ── VISIBILITY TOGGLES ──────────────────────────────────────────────────────
 * These two booleans are the only things you need to change to widen or narrow
 * what a member sees about ANOTHER member. Neither affects a member's own row,
 * and neither affects the admin view — both always return the full record.
 * After changing either one: save, then Deploy > Manage deployments > pencil >
 * New version > Deploy. No client-side change is required.
 *
 * MEMBER_VISIBLE_FAMILY
 *   true  (current) - members see each other's spouse and children: name and
 *                     photo. Children have no name in the sheet other than
 *                     their government first/last, so this does expose minors'
 *                     legal names to every signed-in member. Reviewed and
 *                     accepted 2026-08-29.
 *   false           - spouse and children are withheld from members entirely.
 *
 * MEMBER_VISIBLE_BIRTHDAY
 *   false (current) - no birthday data reaches a member's browser at all.
 *   true            - adds sheetData.birthday as "MM-DD" (month and day only,
 *                     never the birth year; the full date_of_birth stays
 *                     admin-only regardless). Flipping this alone does NOT
 *                     make a birthday appear on screen - userdirectory.html
 *                     has no code that renders it yet. See
 *                     reference/directory-visibility-toggles.md.
 * ────────────────────────────────────────────────────────────────────────────
 */
var MEMBER_VISIBLE_FAMILY   = true;
var MEMBER_VISIBLE_BIRTHDAY = false;

/**
 * Month/day only — the birthday, never the birth year.
 * Returns "" when the stored value is not a usable date.
 */
function birthdayOnly_(dob) {
  if (!dob) return "";
  var d = (dob instanceof Date) ? dob : new Date(dob);
  if (isNaN(d.getTime())) return "";
  var m   = d.getUTCMonth() + 1;
  var day = d.getUTCDate();
  return (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
}

/**
 * Strips family entries down to what the card actually renders.
 */
function publicFamily_(list) {
  return (list || []).map(function(fm) {
    return {
      role:     fm.role     || "",
      name:     fm.name     || "",
      govFirst: fm.govFirst || "",
      govLast:  fm.govLast  || "",
      photo:    fm.photo    || null
    };
  });
}

/**
 * The member-facing view of another member. Everything not explicitly carried
 * over here is dropped before the payload leaves the server.
 */
function publicView_(u) {
  var sd   = u.sheetData || {};
  var safe = {};
  MEMBER_VISIBLE_SHEET_FIELDS.forEach(function(f) {
    if (sd[f] !== undefined) safe[f] = sd[f];
  });
  if (MEMBER_VISIBLE_BIRTHDAY) safe.birthday = birthdayOnly_(sd.date_of_birth);

  return {
    primaryEmail:      u.primaryEmail,
    name:              u.name,
    thumbnailPhotoUrl: u.thumbnailPhotoUrl || null,
    phones:            u.phones            || [],
    organizations:     u.organizations     || [],
    locations:         u.locations         || [],
    relations:         [],
    emails:            [],
    recoveryEmail:     "",
    suspended:         false,
    lastLoginTime:     null,
    creationTime:      null,
    sheetData:         safe,
    spouseInfo:        MEMBER_VISIBLE_FAMILY ? (u.spouseInfo || null) : null,
    familyMembers:     MEMBER_VISIBLE_FAMILY ? publicFamily_(u.familyMembers) : []
  };
}

/**
 * Directory listing, filtered to what the CALLER is allowed to see.
 *
 * Admins get every row in full. Everyone else gets their own row in full,
 * suspended accounts omitted entirely, and every other row reduced to
 * publicView_ above.
 *
 * The redaction runs AFTER the cache read on every single call, so a payload
 * built for an admin can never be replayed from cache to a member.
 */
function getUsers() {
  var all = getUsersFull_();

  var viewer = "";
  try { viewer = Session.getActiveUser().getEmail() || ""; } catch (e) { viewer = ""; }

  var admin = false;
  try {
    admin = isAdmin();
  } catch (e) {
    // Fail closed: a scope error must reduce what an admin sees,
    // never expand what a member sees.
    Logger.log("getUsers: isAdmin() threw, treating caller as non-admin: " + e.message);
    admin = false;
  }

  if (admin) return all;

  var out = [];
  all.forEach(function(u) {
    if (viewer && u.primaryEmail === viewer) { out.push(u); return; }
    if (u.suspended) return;
    out.push(publicView_(u));
  });
  return out;
}

/**
 * PRIVATE — full, unfiltered directory data. Never expose this to the client
 * directly; go through getUsers(), which applies per-caller redaction.
 */
function getUsersFull_() {
  // Cache the full user list for 3 minutes — biggest load time reduction
  var cache     = CacheService.getScriptCache();
  var cached    = cache.get('getUsers_result');
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* cache miss */ }
  }

  var gwUsers   = [];
  var pageToken = null;
  do {
    var opts = { domain: DOMAIN, maxResults: 500, projection: "basic", viewType: "admin_view" };
    if (pageToken) opts.pageToken = pageToken;
    var resp  = AdminDirectory.Users.list(opts);
    if (resp.users) gwUsers = gwUsers.concat(resp.users);
    pageToken = resp.nextPageToken;
  } while (pageToken);

  var sheetResult = readSheet_();
  var headers     = sheetResult.headers;
  var rows        = sheetResult.rows;
  var emailCol    = headers.indexOf("email");

  var sheetMap = {};
  rows.forEach(function(row) {
    var em = row[emailCol] || "";
    if (!em) return;
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i] || ""; });
    sheetMap[em] = obj;
  });

  // Batch-fetch all thumbnail photos server-side so they work for all users
  // (lh3.google.com URLs require auth in the browser — fetching here avoids that)
  var token = ScriptApp.getOAuthToken();
  var photoMap = {};
  var usersWithPhotos = gwUsers.filter(function(u) { return !!u.thumbnailPhotoUrl; });
  if (usersWithPhotos.length > 0) {
    try {
      var requests = usersWithPhotos.map(function(u) {
        return {
          url: u.thumbnailPhotoUrl,
          headers: { Authorization: 'Bearer ' + token },
          muteHttpExceptions: true
        };
      });
      var responses = UrlFetchApp.fetchAll(requests);
      usersWithPhotos.forEach(function(u, i) {
        var resp = responses[i];
        if (resp && resp.getResponseCode() === 200) {
          var ct  = (resp.getHeaders()['Content-Type'] || 'image/jpeg').split(';')[0];
          var b64 = Utilities.base64Encode(resp.getContent());
          photoMap[u.primaryEmail] = 'data:' + ct + ';base64,' + b64;
        }
      });
    } catch(e) {
      Logger.log('Photo batch fetch failed: ' + e.message);
    }
  }

  var result = gwUsers.map(function(u) {
    var sd = sheetMap[u.primaryEmail] || {};

    var spouseInfo = null;
    if (sd.spouse_email && sheetMap[sd.spouse_email]) {
      var sp = gwUsers.find(function(x) { return x.primaryEmail === sd.spouse_email; });
      if (sp) {
        spouseInfo = {
          name:  (sp.name && sp.name.fullName) || sd.spouse_email,
          email: sd.spouse_email,
          photo: photoMap[sd.spouse_email] || sp.thumbnailPhotoUrl || null
        };
      }
    }

    var familyMembers = [];
    if (sd.family_members) {
      try {
        var members = JSON.parse(sd.family_members);
        if (Array.isArray(members)) {
          familyMembers = members.map(function(fm) {
            var fmUser = gwUsers.find(function(x) { return x.primaryEmail === fm.tnEmail; });
            return Object.assign({}, fm, { photo: fmUser ? (photoMap[fmUser.primaryEmail] || fmUser.thumbnailPhotoUrl || null) : null });
          });
        }
      } catch (e) { /* malformed JSON — ignore */ }
    }

    return {
      primaryEmail:      u.primaryEmail,
      name:              u.name,
      thumbnailPhotoUrl: photoMap[u.primaryEmail] || u.thumbnailPhotoUrl || null,
      phones:            u.phones            || [],
      organizations:     u.organizations     || [],
      locations:         u.locations         || [],
      relations:         u.relations         || [],
      emails:            u.emails            || [],
      recoveryEmail:     u.recoveryEmail     || '',
      suspended:         u.suspended         || false,
      lastLoginTime:     u.lastLoginTime     || null,
      creationTime:      u.creationTime      || null,
      sheetData:         sd,
      spouseInfo:        spouseInfo,
      familyMembers:     familyMembers
    };
  });

  // Cache for 3 minutes (180s) — ScriptCache max value size is 100KB
  // If result is too large, skip caching gracefully
  try {
    var json = JSON.stringify(result);
    if (json.length < 90000) {
      cache.put('getUsers_result', json, 180);
    } else {
      Logger.log('getUsers: result too large to cache (' + json.length + ' chars)');
    }
  } catch(e) { Logger.log('getUsers cache write failed: ' + e.message); }

  return result;
}


// ── Directory — write (admin) ─────────────────────────────────────────────────

function updateUser(email, gwData, sheetData) {
  if (!isAdmin()) throw new Error("Admin access required.");
  gwData    = gwData    || {};
  sheetData = sheetData || {};
  var actor = Session.getActiveUser().getEmail();
  var patch = {};

  if (gwData.department || gwData.title) {
    patch.organizations = [{ customType: "work" }];
    if (gwData.department) patch.organizations[0].department = gwData.department;
    if (gwData.title)      patch.organizations[0].title      = gwData.title;
  }

  var phones = [];
  if (gwData.phone)  phones.push({ value: gwData.phone,  type: "work",   primary: true });
  if (gwData.mobile) phones.push({ value: gwData.mobile, type: "mobile" });
  if (phones.length) patch.phones = phones;

  if (gwData.building)       patch.locations = [{ area: gwData.building, type: "desk" }];
  if (gwData.manager)        patch.relations  = [{ value: gwData.manager, type: "manager" }];
  if (gwData.personalEmail)  patch.recoveryEmail = gwData.personalEmail;
  if (gwData.alternateEmail) patch.emails = [
    { address: email,                 type: "work",  primary: true },
    { address: gwData.alternateEmail, type: "other" }
  ];

  // Capture sheet state before writing so we can diff it
  var beforeSheet = {};
  try {
    var sr = readSheet_();
    var sh = sr.headers;
    var ec = sh.indexOf('email');
    for (var ri = 0; ri < sr.rows.length; ri++) {
      if (sr.rows[ri][ec] === email) {
        sh.forEach(function(h, i) { beforeSheet[h] = String(sr.rows[ri][i] || ''); });
        break;
      }
    }
  } catch(e) { Logger.log('updateUser: before-read failed: ' + e.message); }

  if (Object.keys(patch).length > 0) AdminDirectory.Users.patch(patch, email);
  if (sheetData && Object.keys(sheetData).length > 0) updateSheetRow_(email, sheetData);

  // Log each GW field that changed
  var gwFieldMap = {
    title: 'job_title', department: 'department', building: 'building',
    manager: 'manager', personalEmail: 'recovery_email', alternateEmail: 'alternate_email',
    phone: 'work_phone', mobile: 'mobile_phone'
  };
  Object.keys(gwData).forEach(function(k) {
    if (!gwData[k]) return;
    var label = gwFieldMap[k] || k;
    logAudit_(actor, email, 'admin_updated', label, '', String(gwData[k]));
  });

  // Log each sheet field that changed
  Object.keys(sheetData).forEach(function(field) {
    if (field === 'email') return;
    var newVal = String(sheetData[field] || '');
    var oldVal = beforeSheet[field] || '';
    if (newVal !== oldVal) {
      logAudit_(actor, email, 'admin_updated', field, oldVal || '(empty)', newVal || '(empty)');
    }
  });


  // Bust the getUsers cache so next load reflects changes
  try { CacheService.getScriptCache().remove('getUsers_result'); } catch(e) {}

  // Notify admin inbox
  try {
    var subj = '=?UTF-8?B?' + Utilities.base64Encode('Profile Updated (Admin): ' + email) + '?=';
    var body = 'Admin ' + actor + ' updated the profile for ' + email + '.';
    GmailApp.sendEmail(ADMIN_EMAIL, subj, body);
    if (actor !== ADMIN_EMAIL) GmailApp.sendEmail(actor, subj, body);
  } catch(e) { Logger.log('updateUser email error: ' + e.message); }
}

function updateUserBulk(email, department, currentTitle, currentPhone) {
  if (!isAdmin()) throw new Error("Admin access required.");
  var actor = Session.getActiveUser().getEmail();
  var patch = { organizations: [{ department: department, title: currentTitle || "", customType: "work" }] };
  if (currentPhone) patch.phones = [{ value: currentPhone, type: "work", primary: true }];
  AdminDirectory.Users.patch(patch, email);
  logAudit_(actor, email, "bulk_dept_updated", "department", "", department);
}

function suspendUser(email, suspended) {
  if (!isAdmin()) throw new Error("Admin access required.");
  var actor = Session.getActiveUser().getEmail();
  AdminDirectory.Users.patch({ suspended: suspended }, email);
  logAudit_(actor, email, suspended ? "suspended" : "unsuspended");
}

function sendPasswordReset(email) {
  if (!isAdmin()) throw new Error("Admin access required.");
  var actor = Session.getActiveUser().getEmail();
  AdminDirectory.Users.patch({ changePasswordAtNextLogin: true }, email);
  logAudit_(actor, email, "password_reset_forced");
}


// ── Directory — write (self) ──────────────────────────────────────────────────

function updateSelf(email, sheetData, gwData) {
  var actor = Session.getActiveUser().getEmail();
  if (actor !== email) throw new Error("You may only update your own profile.");

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

  var safeData = {};
  SELF_ALLOWED_COLUMNS.forEach(function(col) {
    if (sheetData && sheetData[col] !== undefined) safeData[col] = sheetData[col];
  });

  // Capture before-state
  var beforeSelf = {};
  try {
    var sr2 = readSheet_();
    var sh2 = sr2.headers;
    var ec2 = sh2.indexOf('email');
    for (var ri2 = 0; ri2 < sr2.rows.length; ri2++) {
      if (sr2.rows[ri2][ec2] === email) {
        sh2.forEach(function(h, i) { beforeSelf[h] = String(sr2.rows[ri2][i] || ''); });
        break;
      }
    }
  } catch(e) { Logger.log('updateSelf: before-read failed: ' + e.message); }

  if (Object.keys(safeData).length > 0) updateSheetRow_(email, safeData);

  var gwPatch = {};
  if (gwData && (gwData.phone || gwData.mobile)) {
    var phones = [];
    if (gwData.mobile) phones.push({ value: gwData.mobile, type: "mobile", primary: true });
    if (gwData.phone)  phones.push({ value: gwData.phone,  type: "work" });
    gwPatch.phones = phones;
  }
  // personal_email is the GW recoveryEmail — always patch GW directly
  if (gwData && gwData.personalEmail) gwPatch.recoveryEmail = gwData.personalEmail;
  if (Object.keys(gwPatch).length > 0) AdminDirectory.Users.patch(gwPatch, email);

  // Log each changed sheet field
  Object.keys(safeData).forEach(function(field) {
    var newVal = String(safeData[field] || '');
    var oldVal = beforeSelf[field] || '';
    if (newVal !== oldVal) {
      logAudit_(actor, email, 'self_updated', field, oldVal || '(empty)', newVal || '(empty)');
    }
  });
  // Log GW fields
  if (gwData && gwData.personalEmail) {
    logAudit_(actor, email, 'self_updated', 'recovery_email', '', gwData.personalEmail);
  }
  if (gwData && gwData.mobile) {
    logAudit_(actor, email, 'self_updated', 'mobile_phone', '', gwData.mobile);
  }
  if (gwData && gwData.phone) {
    logAudit_(actor, email, 'self_updated', 'work_phone', '', gwData.phone);
  }


  // Bust the getUsers cache so next load reflects changes
  try { CacheService.getScriptCache().remove('getUsers_result'); } catch(e) {}

  // Notify admin inbox
  try {
    var subj = '=?UTF-8?B?' + Utilities.base64Encode('Profile Updated (Self): ' + email) + '?=';
    var body = email + ' updated their own profile from the staff directory.';
    GmailApp.sendEmail(ADMIN_EMAIL, subj, body);
  } catch(e) { Logger.log('updateSelf email error: ' + e.message); }
}


// ── Audit Log — read ──────────────────────────────────────────────────────────

/**
 * Returns up to the last 100 audit entries for one member.
 *
 * Admins may read any member's log; everyone else may read only their own.
 *
 * An earlier revision removed this guard entirely, on the reasoning that
 * isAdmin() could throw and cause silent failures. isAdmin() does not throw -
 * it wraps AdminDirectory.Members.get in its own try/catch and returns false.
 * What it CAN do is return a cached false for up to 5 minutes (see the
 * getUserCache 'isAdmin' key). So the guard is restored, and a denial now
 * raises a visible error instead of returning an empty list, which is what
 * made the original problem hard to see.
 */
function getAuditLog(targetEmail) {
  if (!targetEmail) return [];

  var caller = Session.getActiveUser().getEmail();
  if (caller !== targetEmail && !isAdmin()) {
    Logger.log('getAuditLog: denied ' + caller + ' -> ' + targetEmail);
    throw new Error('Access denied. You may only view your own audit history.');
  }
  var sheet = getAuditSheet_();
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0].map(String);
  var tCol    = headers.indexOf("target_email");
  return data.slice(1)
    .filter(function(row) { return String(row[tCol] || "") === targetEmail; })
    .reverse()
    .slice(0, 100)
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = String(row[i] || ""); });
      return obj;
    });
}


// ── ID Documents ──────────────────────────────────────────────────────────────

function getIdImages(targetEmail) {
  if (!targetEmail) throw new Error("Email is required.");
  var caller = Session.getActiveUser().getEmail();
  if (caller !== targetEmail && !isAdmin()) throw new Error("Access denied.");

  var emailLower = targetEmail.toLowerCase();
  var frontFile  = null, backFile = null;

  // ── Strategy 1: find files in Drive folder ──────────────────────
  try {
    var fid    = PropertiesService.getScriptProperties().getProperty("SECURE_ID_FOLDER_ID") || DRIVE_FOLDER_ID;
    var folder = DriveApp.getFolderById(fid);
    var iter   = folder.getFiles();
    while (iter.hasNext()) {
      var file = iter.next();
      var name = file.getName().toLowerCase();
      if (name.indexOf("id_front_" + emailLower) === 0) frontFile = file;
      else if (name.indexOf("id_back_" + emailLower) === 0) backFile = file;
    }
  } catch(e) {
    Logger.log("getIdImages Drive search error: " + e.message);
  }

  // ── Strategy 2: look up stored URLs in sheet, get file by ID ────
  if (!frontFile || !backFile) {
    try {
      var sr      = readSheet_();
      var headers = sr.headers;
      var rows    = sr.rows;
      var eIdx    = headers.indexOf("email");
      var fIdx    = headers.indexOf("id_front_url");
      var bIdx    = headers.indexOf("id_back_url");
      var row     = rows.find(function(r) { return r[eIdx] === targetEmail; });
      if (row) {
        function urlToFile(url) {
          if (!url) return null;
          var m = url.match(/\/file\/d\/([^\/]+)\//) || url.match(/[?&]id=([^&]+)/);
          if (m) { try { return DriveApp.getFileById(m[1]); } catch(e2) { return null; } }
          return null;
        }
        if (!frontFile && fIdx > -1) frontFile = urlToFile(row[fIdx]);
        if (!backFile  && bIdx > -1) backFile  = urlToFile(row[bIdx]);
      }
    } catch(e) {
      Logger.log("getIdImages sheet fallback error: " + e.message);
    }
  }

  // ── Fetch file bytes and return as base64 data URLs ──────────────
  function fileToDataUrl(file) {
    if (!file) return { data: null, view: null };
    try {
      var blob     = file.getBlob();
      var b64      = Utilities.base64Encode(blob.getBytes());
      var mimeType = blob.getContentType() || 'image/jpeg';
      return {
        data: 'data:' + mimeType + ';base64,' + b64,
        view: file.getUrl()
      };
    } catch(e) {
      Logger.log("fileToDataUrl error: " + e.message);
      return { data: null, view: null };
    }
  }

  var front = fileToDataUrl(frontFile);
  var back  = fileToDataUrl(backFile);

  return {
    front:     front.data,
    frontView: front.view,
    back:      back.data,
    backView:  back.view
  };
}


// ── Groups ────────────────────────────────────────────────────────────────────

/**
 * Saves one or both ID document images for a user.
 * Called from userdirectory — admin can save for any user, user can save their own.
 * @param {string} targetEmail  - whose ID to update
 * @param {string|null} frontDataUrl - base64 data URL for front, or null to skip
 * @param {string|null} backDataUrl  - base64 data URL for back, or null to skip
 */
function saveIdDocuments(targetEmail, frontDataUrl, backDataUrl) {
  var caller = Session.getActiveUser().getEmail();
  if (caller !== targetEmail && !isAdmin()) throw new Error('Access denied.');
  if (!targetEmail) throw new Error('Email required.');

  var frontUrl = null, backUrl = null;
  if (frontDataUrl) {
    frontUrl = uploadToDrive_(frontDataUrl, 'id_front_' + targetEmail);
    logAudit_(caller, targetEmail, 'id_document_updated', 'id_front', '', 'uploaded');
  }
  if (backDataUrl) {
    backUrl = uploadToDrive_(backDataUrl, 'id_back_' + targetEmail);
    logAudit_(caller, targetEmail, 'id_document_updated', 'id_back', '', 'uploaded');
  }

  // Write Drive URLs back to sheet
  var updates = {};
  if (frontUrl) updates.id_front_url = frontUrl;
  if (backUrl)  updates.id_back_url  = backUrl;
  if (Object.keys(updates).length) updateSheetRow_(targetEmail, updates);

  // Admin notification
  try {
    var subj = '=?UTF-8?B?' + Utilities.base64Encode('ID Documents Updated: ' + targetEmail) + '?=';
    var body = (caller === targetEmail ? targetEmail + ' updated their own ID documents.'
                                       : 'Admin ' + caller + ' updated ID documents for ' + targetEmail + '.');
    GmailApp.sendEmail(ADMIN_EMAIL, subj, body);
    if (caller !== ADMIN_EMAIL) GmailApp.sendEmail(caller, subj, body);
  } catch(e) { Logger.log('saveIdDocuments email error: ' + e.message); }

  return { front: frontUrl, back: backUrl };
}

/**
 * Deletes an ID document file from Drive and clears the sheet URL.
 * @param {string} targetEmail
 * @param {string} side - 'front' or 'back'
 */
function deleteIdDocument(targetEmail, side) {
  var caller = Session.getActiveUser().getEmail();
  if (caller !== targetEmail && !isAdmin()) throw new Error('Access denied.');

  var col = side === 'front' ? 'id_front_url' : 'id_back_url';

  // Find the current URL in the sheet to get the file ID
  var sr = readSheet_();
  var emailCol = sr.headers.indexOf('email');
  var urlCol   = sr.headers.indexOf(col);
  var url = '';
  for (var i = 0; i < sr.rows.length; i++) {
    if (sr.rows[i][emailCol] === targetEmail) { url = sr.rows[i][urlCol] || ''; break; }
  }

  // Try to trash the Drive file
  if (url) {
    try {
      var idMatch = url.match(/[-\w]{25,}/);
      if (idMatch) DriveApp.getFileById(idMatch[0]).setTrashed(true);
    } catch(e) { Logger.log('deleteIdDocument: trash failed (non-fatal): ' + e.message); }
  }

  // Also try by name convention
  try {
    var fname  = 'id_' + side + '_' + targetEmail;
    var folderId = PropertiesService.getScriptProperties().getProperty('SECURE_ID_FOLDER_ID') || DRIVE_FOLDER_ID;
    var folder = DriveApp.getFolderById(folderId);
    var files  = folder.getFilesByName(fname);
    while (files.hasNext()) files.next().setTrashed(true);
  } catch(e) { Logger.log('deleteIdDocument: name-based delete failed: ' + e.message); }

  // Clear the sheet column
  updateSheetRow_(targetEmail, { [col]: '' });
  logAudit_(caller, targetEmail, 'id_document_deleted', col, url || '', '');
  return true;
}

function getAllGroups() {
  if (!isAdmin()) throw new Error("Admin access required.");
  var resp = AdminDirectory.Groups.list({ domain: DOMAIN, maxResults: 200 });
  return (resp.groups || []).map(function(g) { return { name: g.name, email: g.email }; });
}

function getUserGroups(userEmail) {
  if (!isAdmin()) throw new Error("Admin access required.");
  var resp = AdminDirectory.Groups.list({ userKey: userEmail, maxResults: 200 });
  return (resp.groups || []).map(function(g) { return { name: g.name, email: g.email }; });
}

function addToGroup(userEmail, groupEmail) {
  if (!isAdmin()) throw new Error("Admin access required.");
  var actor = Session.getActiveUser().getEmail();
  AdminDirectory.Members.insert({ email: userEmail, role: "MEMBER" }, groupEmail);
  logAudit_(actor, userEmail, "added_to_group", "group", "", groupEmail);
}

function removeFromGroup(userEmail, groupEmail) {
  if (!isAdmin()) throw new Error("Admin access required.");
  var actor = Session.getActiveUser().getEmail();
  AdminDirectory.Members.remove(groupEmail, userEmail);
  logAudit_(actor, userEmail, "removed_from_group", "group", groupEmail, "");
}

// ── Bulk Update ───────────────────────────────────────────────────────────────

/**
 * Updates a single user's fields as part of a bulk operation.
 * Called once per selected user from the frontend.
 * @param {string} email      - Primary email of the user to update
 * @param {string} fieldsJson - JSON object of field keys → values (__CLEAR__ to blank)
 */
function bulkUpdateUser(email, fieldsJson) {
  if (!isAdmin()) throw new Error("Admin access required.");
  var actor  = Session.getActiveUser().getEmail();
  var fields = JSON.parse(fieldsJson);

  var gwPatch   = {};
  var sheetPatch = {};

  // Department
  if ('department' in fields) {
    var dept = fields.department === '__CLEAR__' ? '' : fields.department;
    gwPatch.organizations = gwPatch.organizations || [{ customType: 'work' }];
    gwPatch.organizations[0].department = dept;
    sheetPatch.cost_center = dept;  // also mirror to sheet cost_center if desired
  }

  // Manager
  if ('manager' in fields) {
    var mgr = fields.manager === '__CLEAR__' ? '' : fields.manager;
    gwPatch.relations = mgr ? [{ value: mgr, type: 'manager' }] : [];
  }

  // Employment type (sheet only)
  if ('employmentType' in fields) {
    sheetPatch.employment_type = fields.employmentType === '__CLEAR__' ? '' : fields.employmentType;
  }

  // Cost center (sheet only)
  if ('costCenter' in fields) {
    sheetPatch.cost_center = fields.costCenter === '__CLEAR__' ? '' : fields.costCenter;
  }

  // Branch (sheet only)
  if ('branch' in fields) {
    sheetPatch.branch = fields.branch === '__CLEAR__' ? '' : fields.branch;
  }

  // Apply GW patch
  if (Object.keys(gwPatch).length > 0) {
    AdminDirectory.Users.patch(gwPatch, email);
  }

  // Apply sheet patch
  if (Object.keys(sheetPatch).length > 0) {
    var sr = readSheet_();
    var headers = sr.headers;
    var rows    = sr.rows;
    var emailCol = headers.indexOf('email');
    var rowIdx = rows.findIndex(function(r) { return r[emailCol] === email; });
    if (rowIdx > -1) {
      Object.keys(sheetPatch).forEach(function(col) {
        var ci = headers.indexOf(col);
        if (ci > -1) rows[rowIdx][ci] = sheetPatch[col];
      });
      var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
      var dataRow = rowIdx + 2; // +1 for header, +1 for 1-based index
      Object.keys(sheetPatch).forEach(function(col) {
        var ci = headers.indexOf(col);
        if (ci > -1) sheet.getRange(dataRow, ci + 1).setValue(sheetPatch[col]);
      });
    }
  }

  // Add to group
  if ('addToGroup' in fields && fields.addToGroup && fields.addToGroup !== '__CLEAR__') {
    try {
      AdminDirectory.Members.insert({ email: email, role: 'MEMBER' }, fields.addToGroup);
    } catch(e) { /* already a member — ignore */ }
  }

  logAudit_(actor, email, 'bulk_update', 'multiple', '', JSON.stringify(fields));
}

// ── Self Group Data ───────────────────────────────────────────────────────────

/**
 * Returns { myGroups: [...], allGroups: [...] } for the currently signed-in user.
 * Used by the self-edit modal's Groups tab.
 */
function getSelfGroupData() {
  var email = Session.getActiveUser().getEmail();

  // Groups the user currently belongs to
  var myGroups = [];
  try {
    var resp = AdminDirectory.Groups.list({ userKey: email, maxResults: 200 });
    myGroups = (resp.groups || []).map(function(g) { return { name: g.name, email: g.email }; });
  } catch(e) { Logger.log('getSelfGroupData myGroups error: ' + e.message); }

  // All domain groups (for the request dropdown)
  var allGroups = [];
  try {
    var allResp = AdminDirectory.Groups.list({ domain: DOMAIN, maxResults: 200 });
    allGroups = (allResp.groups || []).map(function(g) { return { name: g.name, email: g.email }; });
  } catch(e) { Logger.log('getSelfGroupData allGroups error: ' + e.message); }

  return { myGroups: myGroups, allGroups: allGroups };
}

/**
 * Sends a group membership request email to tn-admin.
 * The admin then manually adds the user, or a future workflow can automate approval.
 */
function requestGroupMembership(groupEmail, groupName) {
  var requester = Session.getActiveUser().getEmail();
  var subject   = '=?UTF-8?B?' + Utilities.base64Encode('Group Join Request: ' + (groupName || groupEmail)) + '?=';
  var body      = requester + ' has requested to join the group: ' + (groupName || groupEmail) + ' (' + groupEmail + ').\n\nTo approve, add them at: https://admin.google.com/ac/groups';
  GmailApp.sendEmail(ADMIN_EMAIL, subject, body);
  logAudit_(requester, requester, 'group_join_requested', 'group', '', groupEmail);
}

// ── Phone Migration ───────────────────────────────────────────────────────────

/**
 * ONE-TIME migration: moves all users' work phone → mobile phone.
 * Run once from the Apps Script editor: migrateWorkPhoneToMobile()
 */
function migrateWorkPhoneToMobile() {
  var pageToken = null;
  var migrated = 0, skipped = 0, errors = 0;
  do {
    var opts = { domain: DOMAIN, maxResults: 200, projection: 'full', viewType: 'admin_view' };
    if (pageToken) opts.pageToken = pageToken;
    var resp  = AdminDirectory.Users.list(opts);
    var users = resp.users || [];
    pageToken = resp.nextPageToken;

    users.forEach(function(u) {
      try {
        var phones = u.phones || [];
        var work   = phones.find(function(p) { return p.type === 'work'; });
        var mobile = phones.find(function(p) { return p.type === 'mobile'; });

        // Only migrate if there's a work number and no mobile already set
        if (!work || mobile) { skipped++; return; }

        AdminDirectory.Users.patch({
          phones: [{ value: work.value, type: 'mobile', primary: true }]
        }, u.primaryEmail);
        migrated++;
        Logger.log('Migrated: ' + u.primaryEmail);
      } catch(e) {
        errors++;
        Logger.log('Error migrating ' + u.primaryEmail + ': ' + e.message);
      }
    });
  } while (pageToken);

  Logger.log('Migration complete. Migrated: ' + migrated + ', Skipped: ' + skipped + ', Errors: ' + errors);
}

// ── Profile Pre-population ────────────────────────────────────────────────────

/**
 * Returns the current user's sheet data for pre-populating profilesetup.html.
 */
function getMyProfile() {
  var email = Session.getActiveUser().getEmail();
  var sr    = readSheet_();
  var hi    = sr.headers.indexOf('email');
  var row   = sr.rows.find(function(r) { return r[hi] === email; });
  if (!row) return {};
  var obj = {};
  sr.headers.forEach(function(h, i) { obj[h] = row[i] || ''; });
  return obj;
}

// ── Photo Upload ──────────────────────────────────────────────────────────────

/**
 * Uploads a base64 photo and sets it as the user's Google Workspace profile photo.
 * Admins can upload for any user; regular users can only upload their own.
 */
function uploadProfilePhoto(targetEmail, dataUrl) {
  var caller = Session.getActiveUser().getEmail();
  if (caller !== targetEmail && !isAdmin()) throw new Error('Access denied.');
  uploadPhoto_(targetEmail, dataUrl);
}

// ── Self Family Update ────────────────────────────────────────────────────────

/**
 * Updates the current user's spouse and children data in the sheet.
 * familyJson: JSON string of { spouses: [...], children: [...] }
 */
function updateSelfFamily(email, familyJson) {
  var caller = Session.getActiveUser().getEmail();
  if (caller !== email) throw new Error('Access denied.');
  var fam      = JSON.parse(familyJson);
  var spouses  = fam.spouses  || [];
  var children = fam.children || [];

  var updates = {};

  // First spouse fields go to canonical columns
  if (spouses.length > 0) {
    var sp = spouses[0];
    updates.spouse_email        = sp.tnEmail  || '';
    updates.spouse_legal_first  = sp.govFirst || '';
    updates.spouse_legal_last   = sp.govLast  || '';
    updates.spouse_hebrew_first = sp.hebFirst || '';
    updates.spouse_hebrew_last  = sp.hebLast  || '';
  }

  // Serialize all family members (spouses beyond first + children) into family_members
  var allMembers = [];
  spouses.slice(1).forEach(function(sp) {
    allMembers.push({ role: 'spouse', govFirst: sp.govFirst||'', govLast: sp.govLast||'',
                      hebFirst: sp.hebFirst||'', hebLast: sp.hebLast||'', tnEmail: sp.tnEmail||'' });
  });
  children.forEach(function(ch) {
    allMembers.push({ role: 'child', govFirst: ch.govFirst||'', govLast: ch.govLast||'',
                      hebFirst: ch.hebFirst||'', hebLast: ch.hebLast||'' });
  });
  updates.family_members = JSON.stringify(allMembers);

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  updateSheetRow_(email, updates);
  logAudit_(email, email, 'self_family_updated');
}

// ── Google Contacts ───────────────────────────────────────────────────────────

/**
 * Adds a TN staff member to the caller's Google Contacts via People API.
 */
function addToGoogleContacts(targetEmail, displayName) {
  var caller = Session.getActiveUser().getEmail();

  // Look up target user details
  var gwUser;
  try {
    gwUser = AdminDirectory.Users.get(targetEmail, { projection: 'full', viewType: 'admin_view' });
  } catch(e) {
    gwUser = null;
  }

  var givenName  = (gwUser && gwUser.name && gwUser.name.givenName)  || displayName.split(' ')[0] || '';
  var familyName = (gwUser && gwUser.name && gwUser.name.familyName) || displayName.split(' ').slice(1).join(' ') || '';
  var phone      = '';
  if (gwUser && gwUser.phones) {
    var mob = gwUser.phones.find(function(p) { return p.type === 'mobile'; });
    if (mob) phone = mob.value;
  }

  var contactBody = {
    names: [{ givenName: givenName, familyName: familyName, displayName: displayName }],
    emailAddresses: [{ value: targetEmail, type: 'work' }]
  };
  if (phone) contactBody.phoneNumbers = [{ value: phone, type: 'mobile' }];

  // Use People API via UrlFetchApp (People advanced service not always available)
  var token = ScriptApp.getOAuthToken();
  var resp  = UrlFetchApp.fetch('https://people.googleapis.com/v1/people:createContact', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(contactBody),
    muteHttpExceptions: true
  });

  var result = JSON.parse(resp.getContentText());
  if (result.error) throw new Error(result.error.message);
  logAudit_(caller, targetEmail, 'added_to_contacts');
}


/**
 * Returns an array of member email addresses for a given Google Group.
 * Used by the group filter in the staff directory.
 *
 * Admin-only: the group filter is rendered only for admins, and without a guard
 * any signed-in member could enumerate the membership of any group in the
 * domain, including tn-admin@.
 */
function getGroupMembers(groupEmail) {
  if (!isAdmin()) throw new Error("Admin access required.");
  var members = [];
  var pageToken = null;
  do {
    var opts = { maxResults: 200 };
    if (pageToken) opts.pageToken = pageToken;
    var resp = AdminDirectory.Members.list(groupEmail, opts);
    (resp.members || []).forEach(function(m) {
      if (m.email) members.push(m.email.toLowerCase());
    });
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return members;
}

// ── Former Staff Sync ─────────────────────────────────────────────────────────

/**
 * syncDeletedUsers()
 * Run manually from the Apps Script editor.
 *
 * Compares all rows in the Staff Data sheet against active Google Workspace
 * accounts. Any row whose email no longer has a GW account is moved to a
 * "Former Staff" tab (created if it doesn't exist), preserving all data.
 * A "archived_date" column is added to record when the move happened.
 *
 * Nothing is permanently deleted — the Former Staff tab is the archive.
 */
function syncDeletedUsers() {
  var ss          = SpreadsheetApp.openById(SHEET_ID);
  var mainSheet   = ss.getSheets()[0];
  var data        = mainSheet.getDataRange().getValues();
  if (data.length <= 1) { Logger.log('syncDeletedUsers: sheet is empty.'); return; }

  var headers  = data[0].map(String);
  var rows     = data.slice(1);
  var emailCol = headers.indexOf('email');
  if (emailCol === -1) throw new Error('syncDeletedUsers: no "email" column found.');

  // ── Get all active GW emails ────────────────────────────────────
  var activeEmails = {};
  var pageToken = null;
  do {
    var opts = { domain: DOMAIN, maxResults: 500, fields: 'nextPageToken,users(primaryEmail)' };
    if (pageToken) opts.pageToken = pageToken;
    var resp = AdminDirectory.Users.list(opts);
    (resp.users || []).forEach(function(u) { activeEmails[u.primaryEmail] = true; });
    pageToken = resp.nextPageToken;
  } while (pageToken);

  // ── Find rows to archive ────────────────────────────────────────
  var toArchive = [];
  var toKeep    = [headers];

  rows.forEach(function(row) {
    var email = String(row[emailCol] || '').trim().toLowerCase();
    if (!email) { toKeep.push(row); return; }          // blank row — keep
    if (activeEmails[email]) { toKeep.push(row); return; } // still active
    toArchive.push(row);
  });

  if (toArchive.length === 0) {
    Logger.log('syncDeletedUsers: no deleted accounts found. Nothing to archive.');
    return;
  }

  // ── Get or create "Former Staff" tab ───────────────────────────
  var archiveSheet = ss.getSheetByName('Former Staff');
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet('Former Staff');
    Logger.log('syncDeletedUsers: created "Former Staff" tab.');
  }

  // Ensure archive sheet has headers + archived_date column
  var archiveHeaders = headers.slice();
  var archivedDateCol = archiveHeaders.indexOf('archived_date');
  if (archivedDateCol === -1) {
    archiveHeaders.push('archived_date');
    archivedDateCol = archiveHeaders.length - 1;
  }

  // Write headers if archive sheet is empty
  if (archiveSheet.getLastRow() === 0) {
    archiveSheet.getRange(1, 1, 1, archiveHeaders.length).setValues([archiveHeaders]);
  }

  // Append archived rows
  var now = new Date().toISOString();
  var archiveRows = toArchive.map(function(row) {
    var r = row.slice();
    // Pad to header length, then add archived_date
    while (r.length < headers.length) r.push('');
    if (archivedDateCol >= headers.length) {
      r.push(now);
    } else {
      r[archivedDateCol] = now;
    }
    return r;
  });
  archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, archiveRows.length, archiveHeaders.length)
    .setValues(archiveRows);

  // ── Rewrite main sheet without archived rows ────────────────────
  mainSheet.clearContents();
  mainSheet.getRange(1, 1, toKeep.length, headers.length).setValues(toKeep);

  Logger.log('syncDeletedUsers: archived ' + toArchive.length + ' row(s). ' +
             (toKeep.length - 1) + ' active staff remain.');

  // Notify admins
  try {
    var subject = '=?UTF-8?B?' + Utilities.base64Encode('Staff Sync: ' + toArchive.length + ' account(s) archived') + '?=';
    var body    = toArchive.length + ' staff record(s) were moved to the Former Staff tab because their ' +
                  'Google Workspace accounts no longer exist:\n\n' +
                  toArchive.map(function(r) { return r[emailCol]; }).join('\n') +
                  '\n\nRun syncDeletedUsers() again at any time to re-check.';
    GmailApp.sendEmail(ADMIN_EMAIL, subject, body);
  } catch(e) {
    Logger.log('syncDeletedUsers: admin email failed: ' + e.message);
  }
}
