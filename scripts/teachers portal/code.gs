/**
 * TNIC Teacher Portal — multi-class Apps Script web app
 * ===========================================================================
 * ONE gated portal with a tab per class. Two class modes:
 *   - 'claim'    : teachers claim topics FCFS and pin them to their Tuesday
 *                  (Bible Basics).
 *   - 'assigned' : topics are taught in fixed order, one per class-day, teacher
 *                  set by rotation. Read-only for teachers (World History).
 * Plus an Admin tab (tn-admin / apostles / bishops) that governs both classes,
 * and a ?view=public read-only schedule for member-facing pages.
 *
 * SHEET TABS (import the matching CSVs from /reference):
 *   bible_basics_topics   topic_id, topic_name, scripture_refs, description,
 *                         status, claimed_by_email, claimed_by_name, claimed_at,
 *                         teach_date, notes
 *   world_history_topics  topic_id, topic_name, teach_order, scripture_refs, description
 *   class_config          class_key, nth, teacher_email        (rotation; admin-editable)
 *   overrides             class_key, date_iso, teacher_email, topic_id, canceled,
 *                         note, updated_by, updated_at
 *
 * DEPLOY: Execute as ME (an account that can read the groups); Access = domain.
 * See reference/bible-basics-portal-setup.md.
 * ===========================================================================
 */

// ============================ CONFIG ============================
var SPREADSHEET_ID = '1fmbURWbBGIFbWiUZubpY4_KR7RhnCZUGLZOsGHytoV0';
var MOREH_GROUP    = 'moreh@truenation.org';
var ADMIN_GROUPS   = ['tn-admin@truenation.org', 'apostles@truenation.org', 'bishops@truenation.org'];
var ADMIN_NOTIFY   = 'it@truenation.org';
var WEEKS_AHEAD    = 16;

// Structural per-class config. Rotation (WHO) lives in the class_config tab.
var CLASSES = [
  {
    key: 'bible-basics', name: 'Bible Basics', day: 2 /* Tue */,
    tab: 'bible_basics_topics', mode: 'claim'
  },
  {
    key: 'world-history', name: 'World History', day: 3 /* Wed */,
    tab: 'world_history_topics', mode: 'assigned',
    startTopicId: 'WH-029',        // "Saul, David, and Solomon in World Context"
    startDateISO: '2026-07-29'      // first class-day of the cycle (a Wednesday) — edit to go-live
  }
];
// ===============================================================

var CLAIM_COLS = { topic_id:0, topic_name:1, scripture_refs:2, description:3, status:4,
                   claimed_by_email:5, claimed_by_name:6, claimed_at:7, teach_date:8, notes:9 };
var ASSIGNED_COLS = { topic_id:0, topic_name:1, teach_order:2, scripture_refs:3, description:4 };
var OV_COLS = { class_key:0, date_iso:1, teacher_email:2, topic_id:3, canceled:4, note:5, updated_by:6, updated_at:7 };

// ----------------------------- ROUTING -----------------------------

function doGet(e) {
  var view = e && e.parameter && e.parameter.view;
  if (view === 'public') {
    var pub = HtmlService.createTemplateFromFile('public');
    pub.classKey = (e.parameter.class || '');
    return page_(pub, 'TNIC Classes — Schedule');
  }
  var email = me_();
  if (!email || !isMorehMember(email)) {
    var d = HtmlService.createTemplateFromFile('denied');
    d.contact = ADMIN_NOTIFY;
    return page_(d, 'Teacher Portal — Teachers Only');
  }
  var t = HtmlService.createTemplateFromFile('index');
  return page_(t, 'TNIC Teacher Portal');
}

function page_(tmpl, title) {
  return tmpl.evaluate().setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

// ----------------------------- AUTH -----------------------------

function me_() { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }

function isMorehMember(email) { return inGroup_(MOREH_GROUP, email); }

function isAdmin(email) {
  email = email || me_();
  for (var i = 0; i < ADMIN_GROUPS.length; i++) if (inGroup_(ADMIN_GROUPS[i], email)) return true;
  return false;
}
function inGroup_(group, email) {
  if (!email) return false;
  try { AdminDirectory.Members.get(group, email); return true; }
  catch (err) {
    try { return GroupsApp.getGroupByEmail(group).hasUser(email); } catch (e) { return false; }
  }
}
function assertAdmin_() { if (!isAdmin(me_())) throw new Error('Admin access required.'); }

// ----------------------------- READ (portal) -----------------------------

function getPortalState() {
  _MEMO.tabs = {};                 // always read fresh (this often runs right after a write)
  var email = me_();
  var admin = isAdmin(email);
  var classes = CLASSES.map(function (c) { return classState_(c, email); });

  // "My teaching" — every upcoming date assigned to me, across classes.
  var mine = [];
  classes.forEach(function (cs) {
    cs.schedule.forEach(function (r) {
      if (r.teacherEmail === email && r.topicName && !r.canceled)
        mine.push({ className: cs.name, iso: r.iso, month: r.month, day: r.day, topicName: r.topicName, mode: cs.mode, topicId: r.topicId });
    });
  });
  mine.sort(function (a, b) { return a.iso.localeCompare(b.iso); });

  return { me: email, myName: displayName_(email), isAdmin: admin, classes: classes, mine: mine };
}

function classState_(c, email) {
  var rotation = rotation_(c.key);
  var overrides = overridesFor_(c.key);
  var tuesdays = upcomingDays_(c.day, WEEKS_AHEAD);
  var out = { key: c.key, name: c.name, mode: c.mode, day: c.day, rotation: rotation };

  if (c.mode === 'claim') {
    var rows = readTab_(c.tab);
    var topics = rows.map(function (r) {
      return { id: r[CLAIM_COLS.topic_id], name: r[CLAIM_COLS.topic_name],
        ref: r[CLAIM_COLS.scripture_refs] || '', desc: r[CLAIM_COLS.description] || '',
        status: r[CLAIM_COLS.status] || 'Open',
        claimedByEmail: (r[CLAIM_COLS.claimed_by_email] || '').toLowerCase(),
        claimedByName: r[CLAIM_COLS.claimed_by_name] || '',
        teachDate: fmtDate_(r[CLAIM_COLS.teach_date]) };
    });
    var byDate = {}; topics.forEach(function (t) { if (t.teachDate) byDate[t.teachDate] = t; });
    out.topics = topics;
    out.counts = { total: topics.length,
      claimed: topics.filter(function (t) { return t.status === 'Claimed'; }).length,
      open: topics.filter(function (t) { return t.status === 'Open'; }).length };
    out.openDates = tuesdays.filter(function (d) { return !byDate[iso_(d)]; }).map(function (d) {
      var nth = nth_(d);
      return { iso: iso_(d), label: pretty_(d), nth: nth, mine: rotation[nth] === email };
    });
    out.schedule = tuesdays.map(function (d) {
      var iso = iso_(d), nth = nth_(d), t = byDate[iso] || null, ov = overrides[iso];
      var teacher = t ? t.claimedByEmail : (rotation[nth] || '');
      var topicName = t ? t.name : '';
      var canceled = false;
      if (ov) { if (ov.canceled) canceled = true;
        if (ov.teacherEmail) teacher = ov.teacherEmail;
        if (ov.topicId) topicName = topicName_(c, ov.topicId); }
      return { iso: iso, month: mon_(d), day: d.getDate(), nth: nth,
        teacherEmail: teacher, teacherName: displayName_(teacher),
        claimedByEmail: t ? t.claimedByEmail : '',   // the topic owner, regardless of who's displayed as teacher
        topicId: t ? t.id : (ov && ov.topicId ? ov.topicId : ''), topicName: topicName,
        canceled: canceled, overridden: !!ov };
    });

  } else { // assigned
    var ordered = orderedTopics_(c);
    var startIdx = indexOfTopic_(ordered, c.startTopicId);
    var start = dateFromISO_(c.startDateISO);
    out.schedule = tuesdays.map(function (d) {
      var iso = iso_(d), nth = nth_(d), ov = overrides[iso];
      var offset = Math.round((mid_(d) - mid_(start)) / 604800000); // weeks since start
      var idx = ((startIdx + offset) % ordered.length + ordered.length) % ordered.length;
      var topic = ordered[idx];
      var teacher = rotation[nth] || '';
      var topicName = topic ? topic.name : '';
      var topicId = topic ? topic.id : '';
      var canceled = false;
      if (ov) { if (ov.canceled) canceled = true;
        if (ov.teacherEmail) teacher = ov.teacherEmail;
        if (ov.topicId) { topicId = ov.topicId; topicName = topicName_(c, ov.topicId); } }
      return { iso: iso, month: mon_(d), day: d.getDate(), nth: nth,
        teacherEmail: teacher, teacherName: displayName_(teacher),
        topicId: topicId, topicName: topicName, canceled: canceled, overridden: !!ov };
    });
    out.counts = { total: ordered.length };
  }
  return out;
}

// ----------------------------- CLAIM (claim mode, atomic) -----------------------------

function claimTopic(classKey, topicId, dateISO) {
  var c = class_(classKey);
  if (c.mode !== 'claim') return fail_('This class is auto-assigned; topics cannot be claimed.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var email = me_();
    if (!isMorehMember(email)) return fail_('You are not authorized to claim topics.');
    if (!isValidDay_(c.day, dateISO)) return fail_('That is not a valid upcoming class date.');
    var sheet = sheet_(c.tab), data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++)
      if (fmtDate_(data[i][CLAIM_COLS.teach_date]) === dateISO)
        return fail_('That date was just taken by ' + (data[i][CLAIM_COLS.claimed_by_name] || 'another teacher') + '. Pick another.');
    var r = findRow_(data, CLAIM_COLS.topic_id, topicId);
    if (r === -1) return fail_('Topic not found.');
    if ((data[r][CLAIM_COLS.status] || 'Open') !== 'Open')
      return fail_('“' + data[r][CLAIM_COLS.topic_name] + '” was just claimed by ' + (data[r][CLAIM_COLS.claimed_by_name] || 'another teacher') + '.');
    writeClaim_(sheet, r, email, displayName_(email), dateISO);
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

function releaseTopic(classKey, topicId) {
  var c = class_(classKey);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var email = me_(), admin = isAdmin(email);
    var sheet = sheet_(c.tab), data = sheet.getDataRange().getValues();
    var r = findRow_(data, CLAIM_COLS.topic_id, topicId);
    if (r === -1) return fail_('Topic not found.');
    var owner = (data[r][CLAIM_COLS.claimed_by_email] || '').toLowerCase();
    if (owner && owner !== email && !admin)
      return fail_('Only ' + (data[r][CLAIM_COLS.claimed_by_name] || owner) + ' or an admin can release this.');
    var freedDate = fmtDate_(data[r][CLAIM_COLS.teach_date]);
    clearClaim_(sheet, r);
    if (freedDate) deleteOverride_(classKey, freedDate); // don't leave a substitute override on a now-empty date
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

// ----------------------------- GRAB / SUBSTITUTE (any teacher) -----------------------------

/**
 * Any Moreh teacher takes over teaching a specific upcoming date (substitute).
 * Sets a teacher override on that date only — the standing rotation is NOT changed,
 * and the topic (BB: the claimed topic; WH: the sequence topic) stays the same.
 */
function grabDate(classKey, dateISO) {
  var c = class_(classKey);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var email = me_();
    if (!isMorehMember(email)) return fail_('You are not authorized.');
    if (!isValidDay_(c.day, dateISO)) return fail_('That is not a valid upcoming class date.');
    var row = classState_(c, email).schedule.filter(function (r) { return r.iso === dateISO; })[0];
    if (!row || !row.topicName) return fail_('There is no class scheduled that day to teach.');
    if (row.canceled) return fail_('That class is canceled.');
    if (row.teacherEmail === email) return fail_('You are already teaching that date.');
    var rot = rotation_(classKey), nth = nth_(dateFromISO_(dateISO)), ov = overridesFor_(classKey)[dateISO];
    if (ov && ov.teacherEmail && ov.teacherEmail !== email) {
      // The slot owner (rotation teacher, or the BB topic's claimant) can reclaim it from a substitute.
      if (rot[nth] === email || row.claimedByEmail === email) { clearOverrideTeacher_(classKey, dateISO); return { ok: true, state: getPortalState() }; }
      return fail_('That date is already covered by ' + displayName_(ov.teacherEmail) + '.');
    }
    upsertOverride_(classKey, dateISO, email, ov ? ov.topicId : '', ov ? ov.canceled : false);
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

/** Give a grabbed date back to the rotation (only the substitute who took it, or an admin). */
function releaseDate(classKey, dateISO) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var email = me_(), admin = isAdmin(email), ov = overridesFor_(classKey)[dateISO];
    if (!ov || !ov.teacherEmail) return fail_('Nothing to give back on that date.');
    if (ov.teacherEmail !== email && !admin) return fail_('Only ' + displayName_(ov.teacherEmail) + ' or an admin can give this date back.');
    clearOverrideTeacher_(classKey, dateISO);
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

/** Blank the teacher on an override; delete the row if nothing else remains on it. */
function clearOverrideTeacher_(classKey, dateISO) {
  var sheet = sheet_('overrides'), data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][OV_COLS.class_key] === classKey && fmtDate_(data[i][OV_COLS.date_iso]) === dateISO) {
      var hasTopic = !!data[i][OV_COLS.topic_id], canceled = String(data[i][OV_COLS.canceled]).toLowerCase() === 'true';
      if (hasTopic || canceled) sheet.getRange(i + 1, OV_COLS.teacher_email + 1).setValue('');
      else sheet.deleteRow(i + 1);
      SpreadsheetApp.flush(); return true;
    }
  }
  return false;
}

// ----------------------------- ADMIN -----------------------------

function getAdminData(classKey) {
  assertAdmin_();
  var c = class_(classKey);
  var cs = classState_(c, me_());
  var out = { key: c.key, name: c.name, mode: c.mode, rotation: cs.rotation, schedule: cs.schedule };
  if (c.mode === 'claim') out.topics = cs.topics;
  else out.topics = orderedTopics_(c).map(function (t) { return { id: t.id, name: t.name, order: t.order }; });
  return out;
}

/** Change who teaches an nth slot (add/remove/replace a teacher). email '' clears the slot. */
function adminSetRotation(classKey, nth, teacherEmail) {
  assertAdmin_();
  var sheet = sheet_('class_config'), data = sheet.getDataRange().getValues();
  nth = Number(nth); teacherEmail = (teacherEmail || '').toLowerCase();
  for (var i = 1; i < data.length; i++)
    if (data[i][0] === classKey && Number(data[i][1]) === nth) {
      sheet.getRange(i + 1, 3).setValue(teacherEmail); SpreadsheetApp.flush();
      return { ok: true, state: getPortalState() };
    }
  sheet.appendRow([classKey, nth, teacherEmail]); SpreadsheetApp.flush();
  return { ok: true, state: getPortalState() };
}

/** Assigned classes: change a topic's teaching-order position. */
function adminReorder(classKey, topicId, newOrder) {
  assertAdmin_();
  var c = class_(classKey);
  if (c.mode !== 'assigned') return fail_('Reordering applies to auto-assigned classes only.');
  var sheet = sheet_(c.tab), data = sheet.getDataRange().getValues();
  var r = findRow_(data, ASSIGNED_COLS.topic_id, topicId);
  if (r === -1) return fail_('Topic not found.');
  sheet.getRange(r + 1, ASSIGNED_COLS.teach_order + 1).setValue(Number(newOrder));
  SpreadsheetApp.flush();
  return { ok: true, state: getPortalState() };
}

/** Assigned classes: override the teacher/topic for a date, or cancel it. */
function adminSetOverride(classKey, dateISO, teacherEmail, topicId, canceled) {
  assertAdmin_();
  var c = class_(classKey);
  if (!isValidDay_(c.day, dateISO)) return fail_('That is not a valid class date.');
  upsertOverride_(classKey, dateISO, (teacherEmail || '').toLowerCase(), topicId || '', !!canceled);
  return { ok: true, state: getPortalState() };
}
function adminClearOverride(classKey, dateISO) {
  assertAdmin_();
  deleteOverride_(classKey, dateISO);
  return { ok: true, state: getPortalState() };
}
function deleteOverride_(classKey, dateISO) {
  var sheet = sheet_('overrides'), data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--)
    if (data[i][OV_COLS.class_key] === classKey && fmtDate_(data[i][OV_COLS.date_iso]) === dateISO)
      sheet.deleteRow(i + 1);
  SpreadsheetApp.flush();
}

/** Claim classes: admin assigns a topic to a teacher on a date (on their behalf). */
function adminAssignClaim(classKey, topicId, dateISO, teacherEmail) {
  assertAdmin_();
  var c = class_(classKey);
  if (c.mode !== 'claim') return fail_('Use overrides for auto-assigned classes.');
  if (!isValidDay_(c.day, dateISO)) return fail_('That is not a valid class date.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sheet = sheet_(c.tab), data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++)
      if (fmtDate_(data[i][CLAIM_COLS.teach_date]) === dateISO && String(data[i][CLAIM_COLS.topic_id]) !== String(topicId))
        return fail_('That date is already taken. Release it first.');
    var r = findRow_(data, CLAIM_COLS.topic_id, topicId);
    if (r === -1) return fail_('Topic not found.');
    writeClaim_(sheet, r, (teacherEmail || '').toLowerCase(), displayName_(teacherEmail), dateISO);
    deleteOverride_(classKey, dateISO); // a prior substitute override would otherwise mask the assignment
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

// ----------------------------- PUBLIC -----------------------------

function getPublicSchedule(classKey) {
  var c = classKey ? class_(classKey) : null;
  var list = c ? [c] : CLASSES;
  return list.map(function (cc) {
    var cs = classState_(cc, '__public__');
    return { key: cc.key, name: cc.name, mode: cc.mode,
      schedule: cs.schedule.map(function (r) {
        return { iso: r.iso, month: r.month, day: r.day, nth: r.nth,
          teacherName: r.teacherName, topicName: r.topicName, canceled: r.canceled };
      }) };
  });
}

// ----------------------------- CYCLE RESET (claim classes) -----------------------------

function reopenCompletedCycle() {
  CLASSES.filter(function (c) { return c.mode === 'claim'; }).forEach(function (c) {
    var sheet = sheet_(c.tab), data = sheet.getDataRange().getValues(), today = mid_(new Date());
    var allTaught = true, anyClaimed = false;
    for (var i = 1; i < data.length; i++) {
      if ((data[i][CLAIM_COLS.status] || 'Open') === 'Claimed') {
        anyClaimed = true;
        var td = data[i][CLAIM_COLS.teach_date] ? mid_(dateFromISO_(fmtDate_(data[i][CLAIM_COLS.teach_date]))) : null;
        if (!td || td >= today) { allTaught = false; break; }
      } else { allTaught = false; break; }
    }
    if (anyClaimed && allTaught) {
      for (var r = 2; r <= sheet.getLastRow(); r++) {
        sheet.getRange(r, CLAIM_COLS.status + 1).setValue('Open');
        sheet.getRange(r, CLAIM_COLS.claimed_by_email + 1, 1, 4).clearContent();
      }
      SpreadsheetApp.flush();
      MailApp.sendEmail(ADMIN_NOTIFY, c.name + ': new cycle started',
        'All topics were taught. The ' + c.name + ' bucket has reset to Open for the next cycle.');
    }
  });
}

// ----------------------------- HELPERS -----------------------------

// Per-execution memo (each server call is a fresh execution, so this resets naturally).
var _MEMO = { tabs: {}, names: {} };

function class_(key) { for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].key === key) return CLASSES[i]; throw new Error('Unknown class: ' + key); }
function sheet_(tab) { var s = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(tab); if (!s) throw new Error('Tab "' + tab + '" not found.'); return s; }
function readTab_(tab) {
  if (_MEMO.tabs[tab]) return _MEMO.tabs[tab];
  var d = sheet_(tab).getDataRange().getValues();
  var rows = d.slice(1).filter(function (r) { return r[0] !== '' && r[0] != null; });
  _MEMO.tabs[tab] = rows; return rows;
}
function findRow_(data, col, val) { for (var i = 1; i < data.length; i++) if (String(data[i][col]) === String(val)) return i; return -1; }

function rotation_(classKey) {
  var map = {}, rows = readTab_('class_config');
  rows.forEach(function (r) { if (r[0] === classKey) map[Number(r[1])] = (r[2] || '').toLowerCase(); });
  return map;
}
function orderedTopics_(c) {
  return readTab_(c.tab).map(function (r) {
    return { id: r[ASSIGNED_COLS.topic_id], name: r[ASSIGNED_COLS.topic_name], order: Number(r[ASSIGNED_COLS.teach_order]) || 0 };
  }).sort(function (a, b) { return a.order - b.order; });
}
function indexOfTopic_(ordered, id) { for (var i = 0; i < ordered.length; i++) if (ordered[i].id === id) return i; return 0; }
function topicName_(c, id) {
  var rows = readTab_(c.tab), col = (c.mode === 'claim') ? CLAIM_COLS.topic_name : ASSIGNED_COLS.topic_name;
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(id)) return rows[i][col];
  return '';
}
function overridesFor_(classKey) {
  var map = {}, rows = readTab_('overrides');
  rows.forEach(function (r) {
    if (r[OV_COLS.class_key] === classKey) map[fmtDate_(r[OV_COLS.date_iso])] = {
      teacherEmail: (r[OV_COLS.teacher_email] || '').toLowerCase(), topicId: r[OV_COLS.topic_id] || '',
      canceled: String(r[OV_COLS.canceled]).toLowerCase() === 'true' };
  });
  return map;
}
function upsertOverride_(classKey, dateISO, teacherEmail, topicId, canceled) {
  var sheet = sheet_('overrides'), data = sheet.getDataRange().getValues(), me = me_(), now = new Date();
  for (var i = 1; i < data.length; i++)
    if (data[i][OV_COLS.class_key] === classKey && fmtDate_(data[i][OV_COLS.date_iso]) === dateISO) {
      sheet.getRange(i + 1, 3, 1, 6).setValues([[teacherEmail, topicId, canceled, data[i][OV_COLS.note] || '', me, now]]);
      SpreadsheetApp.flush(); return;
    }
  sheet.appendRow([classKey, dateISO, teacherEmail, topicId, canceled, '', me, now]);
  SpreadsheetApp.flush();
}
function writeClaim_(sheet, rowIdx, email, name, dateISO) {
  var r = rowIdx + 1;
  sheet.getRange(r, CLAIM_COLS.status + 1).setValue('Claimed');
  sheet.getRange(r, CLAIM_COLS.claimed_by_email + 1).setValue(email);
  sheet.getRange(r, CLAIM_COLS.claimed_by_name + 1).setValue(name);
  sheet.getRange(r, CLAIM_COLS.claimed_at + 1).setValue(new Date());
  sheet.getRange(r, CLAIM_COLS.teach_date + 1).setValue(dateISO);
  SpreadsheetApp.flush();
}
function clearClaim_(sheet, rowIdx) {
  var r = rowIdx + 1;
  sheet.getRange(r, CLAIM_COLS.status + 1).setValue('Open');
  sheet.getRange(r, CLAIM_COLS.claimed_by_email + 1, 1, 4).clearContent();
  SpreadsheetApp.flush();
}
function displayName_(email) {
  email = (email || '').toLowerCase();
  if (!email || email === '__public__') return '';
  if (_MEMO.names[email] !== undefined) return _MEMO.names[email];      // within this request
  var cache = CacheService.getScriptCache(), key = 'nm_' + email;
  var hit = cache.get(key);
  if (hit !== null) { _MEMO.names[email] = hit; return hit; }           // across requests (6h)
  var name = '';
  try { var u = AdminDirectory.Users.get(email); if (u && u.name && u.name.fullName) name = u.name.fullName; } catch (e) {}
  if (!name) { var l = email.split('@')[0]; name = l.charAt(0).toUpperCase() + l.slice(1); }
  cache.put(key, name, 21600);
  _MEMO.names[email] = name; return name;
}

function nth_(d) { return Math.ceil(d.getDate() / 7); }
function mid_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function pad_(n) { return (n < 10 ? '0' : '') + n; }
function iso_(d) { return d.getFullYear() + '-' + pad_(d.getMonth() + 1) + '-' + pad_(d.getDate()); }
function dateFromISO_(s) { var p = String(s).split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
function fmtDate_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return iso_(v);
  var p = String(v).split('-'); return p.length === 3 ? p[0] + '-' + pad_(Number(p[1])) + '-' + pad_(Number(p[2])) : String(v);
}
function upcomingDays_(weekday, n) {
  var out = [], d = mid_(new Date()); // include today so the class stays visible on its own day
  while (out.length < n) { if (d.getDay() === weekday) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function isValidDay_(weekday, iso) { return upcomingDays_(weekday, WEEKS_AHEAD).some(function (d) { return iso_(d) === iso; }); }
function mon_(d) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]; }
function pretty_(d) { return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()] + ', ' + mon_(d) + ' ' + d.getDate() + ', ' + d.getFullYear(); }
function fail_(reason) { return { ok: false, reason: reason }; }