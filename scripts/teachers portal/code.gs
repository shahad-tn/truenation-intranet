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
 * DATA (2026-09-19, step 1b): this file reads the SHARED scheduling tabs.
 *   topics        class_key, topic_id, topic_name, teach_order, scripture_refs,
 *                 description, notes, retired          <- both classes' catalogues
 *   sessions      one row per class per date. Who teaches it, which topic, its state.
 *                 owner_email is whose slot it is (the claimant); teacher_email is who
 *                 is actually teaching, which differs when a substitute takes it.
 *   class_config  class_key, nth, teacher_email        <- rotation, unchanged for now
 *   config        key, value, note                     <- incl. cycle_started_on.<class>
 *
 * A topic is OPEN unless a session references it on or after its class's
 * cycle_started_on date. There is no status column any more, and nothing is
 * ever cleared to reopen a cycle - the cycle start moves forward instead, so
 * every past session stays on the record.
 *
 * The old `bible_basics_topics`, `world_history_topics` and `overrides` tabs are
 * NOT read or written by this file. They were renamed `zz_old_*` after the switch.
 *
 * Columns are found by HEADER NAME in row 1: order does not matter, extra columns
 * are ignored, and a missing required header stops the action with a clear message.
 * Run checkColumns() from the editor after any change to a header row.
 *
 * DEPLOY: Execute as ME (an account that can read the groups); Access = domain.
 * ===========================================================================
 */

// ============================ CONFIG ============================
var SPREADSHEET_ID = '1fmbURWbBGIFbWiUZubpY4_KR7RhnCZUGLZOsGHytoV0';
var MOREH_GROUP    = 'moreh@truenation.org';
var ADMIN_GROUPS   = ['tn-admin@truenation.org', 'apostles@truenation.org', 'bishops@truenation.org'];
var ADMIN_NOTIFY   = 'it@truenation.org';
var WEEKS_AHEAD    = 16;

// Structural per-class config. Rotation (WHO) lives in the class_config tab;
// topics live in the shared topics tab, keyed by class_key.
var CLASSES = [
  {
    key: 'bible-basics', name: 'Bible Basics', day: 2 /* Tue */, mode: 'claim'
  },
  {
    key: 'world-history', name: 'World History', day: 3 /* Wed */, mode: 'assigned',
    startTopicId: 'WH-029',        // "Saul, David, and Solomon in World Context"
    startDateISO: '2026-07-29'      // first class-day of the cycle (a Wednesday)
  }
];
// ===============================================================

// Required headers per tab. The first entry is the row key: rows where it is blank
// are skipped. Only columns this file actually uses are required, so the tabs may
// carry more (they do - the full set is in claude/sheet-schema.md).
var TAB_COLS = {
  topics:       ['topic_id', 'class_key', 'topic_name', 'teach_order', 'scripture_refs', 'description'],
  sessions:     ['session_id', 'class_key', 'date_iso', 'topic_id', 'title', 'description',
                 'anchor_scripture', 'teacher_email', 'owner_email', 'reader_email', 'state',
                 'updated_by', 'updated_at'],
  class_config: ['class_key', 'nth', 'teacher_email'],
  config:       ['key', 'value', 'note'],
  // read by the slot generator (generate_slots.gs)
  classes:        ['class_key', 'class_name', 'weekday', 'weeks', 'start_time', 'teacher_mode',
                   'topic_mode', 'reader_mode', 'fixed_reader_email', 'rotation_anchor_seq',
                   'rotation_anchor_position', 'active'],
  class_teachers: ['class_key', 'position', 'teacher_email', 'active'],
  reader_pairs:   ['class_key', 'teacher_email', 'reader_email', 'active']
};

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

// ----------------------------- STATE -----------------------------
function getPortalState() {
  _MEMO.tabs = {}; _MEMO.cols = {}; // always read fresh (this often runs right after a write)
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

// ----------------------------- READ (portal) -----------------------------

function classState_(c, email) {
  var rotation = rotation_(c.key);
  var sessions = sessionsFor_(c.key);
  var days = upcomingDays_(c.day, WEEKS_AHEAD);
  var out = { key: c.key, name: c.name, mode: c.mode, day: c.day, rotation: rotation };

  if (c.mode === 'claim') {
    var taken = takenTopics_(c.key, sessions);
    var topics = topicsFor_(c.key).map(function (t) {
      var hit = taken[t.id];
      return { id: t.id, name: t.name, ref: t.ref, desc: t.desc,
        status: hit ? 'Claimed' : 'Open',
        claimedByEmail: hit ? hit.owner : '',
        claimedByName: hit ? displayName_(hit.owner) : '',
        teachDate: hit ? hit.iso : '' };
    });
    out.topics = topics;
    out.counts = { total: topics.length,
      claimed: topics.filter(function (t) { return t.status === 'Claimed'; }).length,
      open: topics.filter(function (t) { return t.status === 'Open'; }).length };
    out.openDates = days.filter(function (d) {
      var s = sessions[iso_(d)];
      return !(s && (s.topicId || s.owner));
    }).map(function (d) {
      var nth = nth_(d);
      return { iso: iso_(d), label: pretty_(d), nth: nth, mine: rotation[nth] === email };
    });
    out.schedule = days.map(function (d) {
      var iso = iso_(d), s = sessions[iso] || null;
      var owner = s ? s.owner : '';
      var teacher = s ? (s.teacher || s.owner) : (rotation[nth_(d)] || '');
      return { iso: iso, month: mon_(d), day: d.getDate(), nth: nth_(d),
        teacherEmail: teacher, teacherName: displayName_(teacher),
        claimedByEmail: owner,                       // the slot's owner, whoever is teaching it
        topicId: s ? s.topicId : '', topicName: s && s.topicId ? topicName_(c, s.topicId) : '',
        canceled: !!(s && s.state === 'skipped'),
        overridden: !!(s && (s.state === 'skipped' || (s.teacher && owner && s.teacher !== owner))) };
    });

  } else { // assigned
    var ordered = orderedTopics_(c);
    var startIdx = indexOfTopic_(ordered, c.startTopicId);
    var start = dateFromISO_(c.startDateISO);
    out.schedule = days.map(function (d) {
      var iso = iso_(d), nth = nth_(d), s = sessions[iso] || null;
      var offset = Math.round((mid_(d) - mid_(start)) / 604800000); // weeks since start
      var idx = ordered.length ? ((startIdx + offset) % ordered.length + ordered.length) % ordered.length : 0;
      var topic = ordered[idx];
      var teacher = rotation[nth] || '';
      var topicId = topic ? topic.id : '';
      var canceled = false;
      if (s) {
        if (s.state === 'skipped') canceled = true;
        if (s.teacher) teacher = s.teacher;
        if (s.topicId) topicId = s.topicId;
      }
      return { iso: iso, month: mon_(d), day: d.getDate(), nth: nth,
        teacherEmail: teacher, teacherName: displayName_(teacher),
        topicId: topicId, topicName: topicId ? topicName_(c, topicId) : '',
        canceled: canceled, overridden: !!(s && (s.teacher || s.topicId || s.state === 'skipped')) };
    });
    out.counts = { total: ordered.length };
  }
  return out;
}

// ----------------------------- TOPICS (shared tab) -----------------------------

function topicsFor_(classKey) {
  var rows = readTab_('topics'), K = cols_('topics');
  var out = [];
  rows.forEach(function (r) {
    if (String(r[K.class_key]).trim() !== classKey) return;
    if (String(r[K.retired] === undefined ? '' : r[K.retired]).toLowerCase() === 'true') return;
    out.push({ id: String(r[K.topic_id]), name: r[K.topic_name] || '',
      ref: r[K.scripture_refs] || '', desc: r[K.description] || '',
      order: Number(r[K.teach_order]) || 0 });
  });
  return out;
}

function orderedTopics_(c) {
  return topicsFor_(c.key).sort(function (a, b) { return a.order - b.order; });
}

function topicName_(c, id) {
  var list = topicsFor_(c.key);
  for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i].name;
  return '';
}

/** topic_id -> {owner, iso} for every topic taught on or after this class's cycle start. */
function takenTopics_(classKey, sessions) {
  var cycleStart = cycleStart_(classKey), out = {};
  Object.keys(sessions).forEach(function (iso) {
    var s = sessions[iso];
    if (!s.topicId || iso < cycleStart) return;
    out[String(s.topicId)] = { owner: s.owner || s.teacher, iso: iso };
  });
  return out;
}

// ----------------------------- SESSIONS -----------------------------

/** dateISO -> session, for one class. Row numbers are 1-based sheet rows. */
function sessionsFor_(classKey) {
  var sheet = sheet_('sessions'), data = sheet.getDataRange().getValues();
  var K = cols_('sessions', data[0]), out = {};
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[K.class_key] || '').trim() !== classKey) continue;
    var iso = fmtDate_(r[K.date_iso]);
    if (!iso) continue;
    out[iso] = { row: i + 1, iso: iso,
      topicId: String(r[K.topic_id] || ''),
      teacher: String(r[K.teacher_email] || '').toLowerCase(),
      owner: String(r[K.owner_email] || '').toLowerCase(),
      reader: String(r[K.reader_email] || '').toLowerCase(),
      state: String(r[K.state] || 'scheduled') };
  }
  return out;
}

/** Create or update one session row, by named column. Returns the sheet row. */
function writeSession_(classKey, dateISO, values) {
  var sheet = sheet_('sessions'), data = sheet.getDataRange().getValues();
  var K = cols_('sessions', data[0]), now = new Date(), me = me_();
  values.updated_by = me; values.updated_at = now;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][K.class_key] || '').trim() === classKey &&
        fmtDate_(data[i][K.date_iso]) === dateISO) {
      setCells_(sheet, i + 1, K, values);
      SpreadsheetApp.flush();
      return i + 1;
    }
  }
  values.session_id = classKey + '-' + dateISO;
  values.class_key = classKey;
  values.date_iso = dateISO;
  if (values.state === undefined) values.state = 'scheduled';
  sheet.appendRow(rowFor_(sheet, K, values));
  SpreadsheetApp.flush();
  return sheet.getLastRow();
}

/** Delete a session row outright. Used when a claim is released - the row existed only for it. */
function deleteSession_(classKey, dateISO) {
  var sheet = sheet_('sessions'), data = sheet.getDataRange().getValues();
  var K = cols_('sessions', data[0]);
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][K.class_key] || '').trim() === classKey &&
        fmtDate_(data[i][K.date_iso]) === dateISO) {
      sheet.deleteRow(i + 1); SpreadsheetApp.flush(); return true;
    }
  }
  return false;
}

/** True when a row carries nothing worth keeping once the teacher override is gone. */
function sessionIsEmpty_(s) {
  return !s.topicId && !s.owner && s.state !== 'skipped';
}

// ----------------------------- CLASS CONFIG (all ten classes) -----------------------------
//
// CLASSES at the top of this file is the OLD two-class config, and it still drives this
// portal's own tabbed UI. Everything that WRITES must work for all ten, so it reads the
// classes tab instead - that is the source of truth since step 2a.

function classCfg_(classKey) {
  var rows = readTab_('classes'), K = cols_('classes');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][K.class_key]).trim() !== classKey) continue;
    return {
      key: classKey,
      name: String(rows[i][K.class_name] || classKey),
      teacherMode: String(rows[i][K.teacher_mode] || '').trim(),
      topicMode: String(rows[i][K.topic_mode] || '').trim(),
      readerMode: String(rows[i][K.reader_mode] || '').trim(),
      active: String(rows[i][K.active]).toLowerCase() !== 'false'
    };
  }
  throw new Error('Unknown class: ' + classKey);
}

// ----------------------------- CONFIG TAB -----------------------------

function cfg_(key, dflt) {
  var rows = readTab_('config'), K = cols_('config');
  for (var i = 0; i < rows.length; i++)
    if (String(rows[i][K.key]).trim() === key) return rows[i][K.value];
  return dflt === undefined ? '' : dflt;
}

function setCfg_(key, value, note) {
  var sheet = sheet_('config'), data = sheet.getDataRange().getValues();
  var K = cols_('config', data[0]);
  for (var i = 1; i < data.length; i++)
    if (String(data[i][K.key]).trim() === key) {
      sheet.getRange(i + 1, K.value + 1).setValue(value);
      SpreadsheetApp.flush(); return;
    }
  sheet.appendRow(rowFor_(sheet, K, { key: key, value: value, note: note || '' }));
  SpreadsheetApp.flush();
}

/** A topic counts as taken only from this date onwards. Blank means "all of history". */
function cycleStart_(classKey) {
  var v = cfg_('cycle_started_on.' + classKey, '');
  return v ? fmtDate_(v) : '0000-00-00';
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
    _MEMO.tabs = {};
    var sessions = sessionsFor_(classKey), here = sessions[dateISO];
    if (here && (here.topicId || here.owner))
      return fail_('That date was just taken by ' + (displayName_(here.owner || here.teacher) || 'another teacher') + '. Pick another.');
    var topic = topicById_(c, topicId);
    if (!topic) return fail_('Topic not found.');
    var taken = takenTopics_(classKey, sessions)[String(topicId)];
    if (taken)
      return fail_('“' + topic.name + '” was just claimed by ' + (displayName_(taken.owner) || 'another teacher') + '.');
    writeSession_(classKey, dateISO, { topic_id: topicId, owner_email: email, teacher_email: email, state: 'scheduled' });
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

function releaseTopic(classKey, topicId) {
  var c = class_(classKey);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var email = me_(), admin = isAdmin(email);
    if (!isMorehMember(email) && !admin) return fail_('You are not authorized.');
    _MEMO.tabs = {};
    var sessions = sessionsFor_(classKey), found = null;
    Object.keys(sessions).forEach(function (iso) {
      if (String(sessions[iso].topicId) === String(topicId)) found = sessions[iso];
    });
    if (!found) {
      // v1 treated releasing an unclaimed topic as a harmless no-op, and the UI shows any
      // reason as an error toast. Keep that: nothing to release is not a failure.
      if (!topicById_(c, topicId)) return fail_('Topic not found.');
      return { ok: true, state: getPortalState() };
    }
    var owner = found.owner || found.teacher;
    if (owner && owner !== email && !admin)
      return fail_('Only ' + (displayName_(owner) || owner) + ' or an admin can release this.');
    deleteSession_(classKey, found.iso);   // the row existed only because of the claim
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

// ----------------------------- GRAB / SUBSTITUTE (any teacher) -----------------------------

/**
 * Any Moreh teacher takes over teaching a specific upcoming date (substitute).
 * Sets teacher_email on that date's session; owner_email is untouched, so the slot's
 * owner (the claimant, or the rotation) can take it back.
 */
function grabDate(classKey, dateISO) {
  var c = classCfg_(classKey);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var email = me_();
    if (!isMorehMember(email)) return fail_('You are not authorized.');
    _MEMO.tabs = {};
    // A date is valid when a generated slot exists for it (step 2a). That replaces the old
    // "is it the right weekday" test, which could not express 2nd-and-4th cadences.
    var sessions = sessionsFor_(classKey), s = sessions[dateISO];
    if (!s) return fail_('There is no class scheduled that day to teach.');
    // Classes that run a topic catalogue need one chosen before anyone can teach it; the
    // other eight have no catalogue at all, so the slot alone is enough.
    if ((c.topicMode === 'claim' || c.topicMode === 'sequence') && !s.topicId)
      return fail_('There is no class scheduled that day to teach.');
    if (s.state === 'skipped') return fail_('That class is canceled.');
    var rot = rotation_(classKey), nth = nth_(dateFromISO_(dateISO));
    var currentTeacher = s.teacher || s.owner || rot[nth] || '';
    if (currentTeacher === email) return fail_('You are already teaching that date.');

    var owner = s.owner;
    var substitute = s.teacher && s.teacher !== (owner || rot[nth] || '');
    if (substitute && s.teacher !== email) {
      // The slot's owner - the rotation teacher, or the claimant - can take it back.
      if (rot[nth] === email || owner === email) { restoreTeacher_(classKey, dateISO); return { ok: true, state: getPortalState() }; }
      return fail_('That date is already covered by ' + displayName_(s.teacher) + '.');
    }
    writeSession_(classKey, dateISO, { teacher_email: email });
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

/** Give a grabbed date back (only the substitute who took it, or an admin). */
function releaseDate(classKey, dateISO) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var email = me_(), admin = isAdmin(email);
    if (!isMorehMember(email) && !admin) return fail_('You are not authorized.');
    _MEMO.tabs = {};
    var s = sessionsFor_(classKey)[dateISO];
    var rot = rotation_(classKey), nth = nth_(dateFromISO_(dateISO));
    var owner = s ? s.owner : '';
    if (!s || !s.teacher || s.teacher === (owner || rot[nth] || '')) return fail_('Nothing to give back on that date.');
    if (s.teacher !== email && !admin) return fail_('Only ' + displayName_(s.teacher) + ' or an admin can give this date back.');
    restoreTeacher_(classKey, dateISO);
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

/** Hand a date back to its owner: the claimant if there is one, otherwise the rotation. */
function restoreTeacher_(classKey, dateISO) {
  var s = sessionsFor_(classKey)[dateISO];
  if (!s) return false;
  if (sessionIsEmpty_({ topicId: s.topicId, owner: s.owner, state: s.state })) {
    deleteSession_(classKey, dateISO);      // nothing but the substitute was on it
  } else {
    writeSession_(classKey, dateISO, { teacher_email: s.owner || '' });
  }
  return true;
}

// ----------------------------- ADMIN (rotation) -----------------------------
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
/** Change who teaches an nth slot (add/remove/replace a teacher). email '' clears the slot. */
function adminSetRotation(classKey, nth, teacherEmail) {
  assertAdmin_();
  var sheet = sheet_('class_config'), data = sheet.getDataRange().getValues(), G = cols_('class_config', data[0]);
  nth = Number(nth); teacherEmail = (teacherEmail || '').toLowerCase();
  for (var i = 1; i < data.length; i++)
    if (data[i][G.class_key] === classKey && Number(data[i][G.nth]) === nth) {
      sheet.getRange(i + 1, G.teacher_email + 1).setValue(teacherEmail); SpreadsheetApp.flush();
      return { ok: true, state: getPortalState() };
    }
  sheet.appendRow(rowFor_(sheet, G, { class_key: classKey, nth: nth, teacher_email: teacherEmail })); SpreadsheetApp.flush();
  return { ok: true, state: getPortalState() };
}

/** Assigned classes: change a topic's teaching-order position. */

// ----------------------------- ADMIN -----------------------------

/** Assigned classes: change a topic's teaching-order position (in the shared topics tab). */
function adminReorder(classKey, topicId, newOrder) {
  assertAdmin_();
  var c = class_(classKey);
  if (c.mode !== 'assigned') return fail_('Reordering applies to auto-assigned classes only.');
  var sheet = sheet_('topics'), data = sheet.getDataRange().getValues(), K = cols_('topics', data[0]);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][K.class_key]).trim() === classKey && String(data[i][K.topic_id]) === String(topicId)) {
      sheet.getRange(i + 1, K.teach_order + 1).setValue(Number(newOrder));
      SpreadsheetApp.flush();
      return { ok: true, state: getPortalState() };
    }
  }
  return fail_('Topic not found.');
}

/** Override the teacher/topic for a date, or cancel it. */
function adminSetOverride(classKey, dateISO, teacherEmail, topicId, canceled) {
  assertAdmin_();
  var c = class_(classKey);
  if (!isValidDay_(c.day, dateISO)) return fail_('That is not a valid class date.');
  _MEMO.tabs = {};
  writeSession_(classKey, dateISO, {
    teacher_email: (teacherEmail || '').toLowerCase(),
    topic_id: topicId || '',
    state: canceled ? 'skipped' : 'scheduled'
  });
  return { ok: true, state: getPortalState() };
}

/** Undo an admin override: back to the rotation (or the claimant), not cancelled. */
function adminClearOverride(classKey, dateISO) {
  assertAdmin_();
  _MEMO.tabs = {};
  var s = sessionsFor_(classKey)[dateISO];
  if (!s) return { ok: true, state: getPortalState() };
  if (!s.owner) {
    deleteSession_(classKey, dateISO);              // assigned class: the row was the override
  } else {
    writeSession_(classKey, dateISO, { teacher_email: s.owner, state: 'scheduled' });
  }
  return { ok: true, state: getPortalState() };
}

/** Claim classes: admin assigns a topic to a teacher on a date (on their behalf). */
function adminAssignClaim(classKey, topicId, dateISO, teacherEmail) {
  assertAdmin_();
  var c = class_(classKey);
  if (c.mode !== 'claim') return fail_('Use overrides for auto-assigned classes.');
  if (!isValidDay_(c.day, dateISO)) return fail_('That is not a valid class date.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    _MEMO.tabs = {};
    if (!topicById_(c, topicId)) return fail_('Topic not found.');
    var sessions = sessionsFor_(classKey), here = sessions[dateISO];
    if (here && here.topicId && String(here.topicId) !== String(topicId))
      return fail_('That date is already taken. Release it first.');
    var taken = takenTopics_(classKey, sessions)[String(topicId)];
    if (taken && taken.iso !== dateISO) {
      // Moving a claim to another date is allowed - that is what an admin assigning it means -
      // but only forwards. A session already taught is history and is not rewritten.
      if (taken.iso < iso_(new Date()))
        return fail_('That topic was already taught on ' + taken.iso + '.');
      deleteSession_(classKey, taken.iso);
      _MEMO.tabs = {};
    }
    var email = (teacherEmail || '').toLowerCase();
    writeSession_(classKey, dateISO, { topic_id: topicId, owner_email: email, teacher_email: email, state: 'scheduled' });
    return { ok: true, state: getPortalState() };
  } finally { lock.releaseLock(); }
}

// ----------------------------- CYCLE RESET (claim classes) -----------------------------

/**
 * Admin-only. When every topic in a claim class has been taught on or after the current
 * cycle start, move the cycle start to today: every topic is Open again and nothing is
 * erased. A time-driven trigger runs as its owner, who must be an admin.
 */
function reopenCompletedCycle() {
  assertAdmin_();
  CLASSES.filter(function (c) { return c.mode === 'claim'; }).forEach(function (c) {
    _MEMO.tabs = {};
    var topics = topicsFor_(c.key);
    if (!topics.length) return;
    var taken = takenTopics_(c.key, sessionsFor_(c.key)), today = iso_(new Date());
    var allTaught = true;
    for (var i = 0; i < topics.length; i++) {
      var hit = taken[String(topics[i].id)];
      if (!hit || hit.iso >= today) { allTaught = false; break; }
    }
    if (!allTaught) return;
    setCfg_('cycle_started_on.' + c.key, today, 'Moved forward when the previous cycle completed');
    MailApp.sendEmail(ADMIN_NOTIFY, c.name + ': new cycle started',
      'All topics were taught. The ' + c.name + ' bucket is Open again for the next cycle. ' +
      'Nothing was erased - the cycle start moved to ' + today + '.');
  });
}

// ----------------------------- SMALL HELPERS -----------------------------

function topicById_(c, topicId) {
  var list = topicsFor_(c.key);
  for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(topicId)) return list[i];
  return null;
}

// ----------------------------- CALLED BY THE PORTAL -----------------------------
//
// Apps Script is the ONLY thing that writes this workbook (sheet-schema.md, Decision A):
// a Sheet has no queue, and a lock taken here is invisible to anything outside Apps Script,
// so two writers eventually lose an edit to each other silently.
//
// The portal in Next.js never writes. Its server calls these functions through the Apps
// Script API (scripts.run), with the service account impersonating the signed-in person.
// GOOGLE enforces who that is: Session.getActiveUser() returns them, so there is no shared
// secret, no actor field to trust, and nothing anonymous exposed on the internet.
// Proved 2026-09-21; see claude/CONTINUE-HERE.md for the setup that makes it work.
//
// Every function reachable this way gates itself - being able to call the API is not
// permission to do anything in particular.

// ----------------------------- TITLES -----------------------------

/**
 * Write what a session is about. Any moreh member or admin may edit any session
 * (Shahad, 2026-09-20 - deliberately open while this is being built out; updated_by
 * still records who last touched it). Fields are optional: send only what changed.
 *
 * The session row must already exist - slots are generated (generate_slots.gs), and a
 * title without a date on the schedule would be invisible.
 */
function submitTitle(classKey, dateISO, fields) {
  var c = classCfg_(classKey);                       // the classes tab, so all ten work
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var email = me_();
    if (!isMorehMember(email) && !isAdmin(email)) return fail_('You are not authorized to edit class details.');
    _MEMO.tabs = {};
    var s = sessionsFor_(classKey)[dateISO];
    if (!s) return fail_('There is no session for that class on that date.');

    var values = {};
    if (fields.title !== undefined)            values.title = String(fields.title).trim();
    if (fields.description !== undefined)      values.description = String(fields.description).trim();
    if (fields.anchorScripture !== undefined)  values.anchor_scripture = String(fields.anchorScripture).trim();
    if (!Object.keys(values).length) return fail_('Nothing to save.');

    writeSession_(classKey, dateISO, values);
    // No state. submitTitle is the ONE write function the old two-class UI in
    // index.html never calls - its only caller is the Next.js session page,
    // which re-reads the sheet itself and throws a state payload away. Every
    // other write function here still returns getPortalState(), because
    // index.html repaints from it. Do not "make this consistent" with them.
    return { ok: true };
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

// Admin-only: without this check any moreh@ member could run it from the browser
// console. A time-driven trigger runs as its owner, who must be an admin.

// ----------------------------- HELPERS -----------------------------
// Per-execution memo (each server call is a fresh execution, so this resets naturally).
var _MEMO = { tabs: {}, names: {}, cols: {} };
function class_(key) { for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].key === key) return CLASSES[i]; throw new Error('Unknown class: ' + key); }
function sheet_(tab) { var s = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(tab); if (!s) throw new Error('Tab "' + tab + '" not found.'); return s; }
function readTab_(tab) {
  if (_MEMO.tabs[tab]) return _MEMO.tabs[tab];
  var d = sheet_(tab).getDataRange().getValues();
  var key = cols_(tab, d[0])[colsFor_(tab)[0]];
  var rows = d.slice(1).filter(function (r) { return r[key] !== '' && r[key] != null; });
  _MEMO.tabs[tab] = rows; return rows;
}
function findRow_(data, col, val) { for (var i = 1; i < data.length; i++) if (String(data[i][col]) === String(val)) return i; return -1; }
function rotation_(classKey) {
  var map = {}, rows = readTab_('class_config'), G = cols_('class_config');
  rows.forEach(function (r) { if (r[G.class_key] === classKey) map[Number(r[G.nth])] = (r[G.teacher_email] || '').toLowerCase(); });
  return map;
}
function indexOfTopic_(ordered, id) { for (var i = 0; i < ordered.length; i++) if (ordered[i].id === id) return i; return 0; }
function setCells_(sheet, r, K, values) {
  Object.keys(values).forEach(function (n) { sheet.getRange(r, K[n] + 1).setValue(values[n]); });
}
/** A full-width row for appendRow, with each value placed under its header. */
/** A full-width row for appendRow, with each value placed under its header. */
function rowFor_(sheet, K, values) {
  var row = [];
  var width = sheet.getLastColumn();          // once, not once per column
  for (var i = 0; i < width; i++) row.push('');
  Object.keys(values).forEach(function (n) { row[K[n]] = values[n]; });
  return row;
}

// ----------------------------- COLUMNS BY HEADER NAME -----------------------------

/** The required headers for a tab (by its own name, or by its class mode). */
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

// ----------------------------- COLUMNS BY HEADER NAME -----------------------------
/** The required headers for a tab. */
function colsFor_(tab) {
  if (TAB_COLS[tab]) return TAB_COLS[tab];
  throw new Error('No column list for tab "' + tab + '".');
}
/**
 * Header name -> 0-based column index for a tab, read from row 1 once per request.
 * Matching ignores case and surrounding spaces. Throws if a required header is
 * missing or appears twice, so a bad header row stops the action instead of
 * silently writing to the wrong column. Pass headerRow when it is already in hand.
 */
function cols_(tab, headerRow) {
  if (_MEMO.cols[tab]) return _MEMO.cols[tab];
  if (!headerRow) {
    var s = sheet_(tab);
    headerRow = s.getRange(1, 1, 1, Math.max(s.getLastColumn(), 1)).getValues()[0];
  }
  var map = Object.create(null), dup = Object.create(null);
  headerRow.forEach(function (h, i) {
    var k = String(h == null ? '' : h).trim().toLowerCase();
    if (!k) return;
    if (k in map) dup[k] = true; else map[k] = i;
  });
  colsFor_(tab).forEach(function (n) {
    if (!(n in map)) throw new Error('Tab "' + tab + '" is missing column "' + n + '". Check its header row.');
    if (dup[n]) throw new Error('Tab "' + tab + '" has column "' + n + '" more than once. Remove the duplicate.');
  });
  _MEMO.cols[tab] = map;
  return map;
}
function colLetter_(i) {
  var s = ''; i = i + 1;
  while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

/**
 * Admin-only. Run from the Apps Script editor after pasting, and after any change
 * to a header row. Logs one line per tab: OK with where each column was found,
 * or FAIL with what is wrong.
 */
/**
 * Admin-only. Run from the Apps Script editor after pasting, and after any change
 * to a header row. Logs one line per tab: OK with where each column was found,
 * or FAIL with what is wrong.
 */
function checkColumns() {
  assertAdmin_();
  var tabs = Object.keys(TAB_COLS);
  var lines = tabs.map(function (tab) {
    try {
      var K = cols_(tab);
      return 'OK    ' + tab + ': ' + colsFor_(tab).map(function (n) { return n + '=' + colLetter_(K[n]); }).join(', ');
    } catch (e) {
      return 'FAIL  ' + tab + ': ' + e.message;
    }
  });
  var report = lines.join('\n');
  Logger.log(report);
  return report;
}

// ----------------------------- IDENTITY PROOF (Apps Script API) -----------------------------
//
// Called through the Apps Script API (scripts.run) by the portal's service account, which
// impersonates one domain user. The whole question this answers: does that impersonated user
// arrive here as the ACTIVE user? If it does, the portal needs no shared secret and no actor
// field - Google enforces identity. Proved 2026-09-21, and the shim is now gone.
//
//   activeUser    who the call is running AS (the impersonated person, we hope)
//   effectiveUser whose authorisation the script is using (the deploying account)
/**
 * The smallest possible function: touches no service, reads nothing, cannot throw.
 * If even THIS fails through the Apps Script API, the failure is in loading or running
 * the project at all, not in anything the code does.
 */
function apiEcho() { return 'hello'; }

function apiPing() {
  var active = '';
  var effective = '';
  try { active = (Session.getActiveUser().getEmail() || ''); } catch (e) { active = 'ERROR: ' + e.message; }
  try { effective = (Session.getEffectiveUser().getEmail() || ''); } catch (e) { effective = 'ERROR: ' + e.message; }
  return {
    ok: true,
    activeUser: active,
    effectiveUser: effective,
    isMoreh: active ? isMorehMember(active.toLowerCase()) : false,
    isAdmin: active ? isAdmin(active.toLowerCase()) : false,
    sheetReachable: (function () {
      try { return !!sheet_('sessions').getLastRow(); } catch (e) { return 'ERROR: ' + e.message; }
    })()
  };
}
