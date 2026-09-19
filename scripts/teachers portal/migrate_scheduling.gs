/**
 * TNIC scheduling — Step 1b migration
 * ===========================================================================
 * Builds the new scheduling tabs from the agreed schema (claude/sheet-schema.md)
 * and converts the data that already exists into them.
 *
 * READ-ONLY on every existing tab. `bible_basics_topics`, `world_history_topics`,
 * `class_config` and `overrides` are never written, never cleared, never deleted.
 * Rollback is: delete the new tabs, re-paste the previous code.gs.
 *
 * SELF-CONTAINED. It depends on nothing in code.gs, so it can be pasted into the Teacher
 * Portal project or into a project of its own. Every name here starts with mig_ or MIG_,
 * so it cannot collide with the Teacher Portal's code.
 *
 * RUN FROM THE APPS SCRIPT EDITOR, admin only:
 *   migrationPreview()  - writes nothing, logs exactly what apply would do
 *   migrationApply()    - creates the tabs and fills them
 *
 * Refuses to run twice: if any target tab already holds data, it stops.
 * Slot generation is NOT here - that is step 2. Only rows that exist today are
 * carried over, so `seq_no` is left blank for step 2 to assign.
 * ===========================================================================
 */

// The agreed model. Teacher modes are 'rotation' (1..n members), 'claim' or 'panel'.
// A single-teacher class is a rotation of one, so adding a teacher later is a row, not code.
var MIG_CLASSES = [
  // key, name, weekday(Sun=0), weeks, start, mins, teacher_mode, topic_mode, reader_mode,
  // fixed_reader, flag_missing_reader, postpone_default, skip_consumes_turn, order
  ['qa-on-the-spot-a-team', 'Q&A: On The Spot',                   1, '1',         '19:30', 90,  'panel',    'none',     'none',  '',          false, 'skip', false, 1],
  ['los-discipulos',        'Los Discipulos de la Palabra',       1, '2,4',       '19:30', 90,  'rotation', 'none',     'pair',  '',          true,  'skip', false, 2],
  ['bible-basics',          'Bible Basics',                       2, '1,2,3,4,5', '19:30', 90,  'claim',    'claim',    'pair',  '',          true,  'skip', false, 3],
  ['world-history',         'World History According to the Bible',3,'1,2,3,4,5', '19:30', 90,  'rotation', 'sequence', 'open',  '',          false, 'push', false, 4],
  ['stick-to-the-script',   'Stick to the Script',                4, '2,4',       '19:30', 90,  'rotation', 'none',     'pair',  '',          true,  'skip', true,  5],
  ['blue-strip',            'Blue Strip',                         5, '1,2,3,4,5', '17:30', 90,  'rotation', 'none',     'fixed', 'izarahla',  true,  'skip', false, 6],
  ['room-144',              'Room 144',                           5, '1,2,3,4,5', '19:30', 90,  'rotation', 'none',     'pair',  '',          true,  'push', false, 7],
  ['deaconstruction',       'Deaconstruction',                    5, '1,2,3,4,5', '21:45', 90,  'rotation', 'none',     'fixed', 'rakab',     true,  'skip', false, 8],
  ['war-for-the-kingdom',   'War for The Kingdom',                6, '1,2,3,4,5', '14:00', 120, 'rotation', 'none',     'open',  '',          false, 'skip', false, 9],
  ['feed-the-sheep',        'Feed The Sheep',                     6, '1,2,3,4,5', '16:30', 120, 'rotation', 'none',     'none',  '',          false, 'skip', false, 10]
];

var MIG_TEACHERS = [
  ['los-discipulos', 1, 'ash'], ['los-discipulos', 2, 'malaakaya'],
  ['world-history', 1, 'ahmanahla'],
  ['stick-to-the-script', 1, 'banayah'], ['stick-to-the-script', 2, 'shahad'],
  ['stick-to-the-script', 3, 'raiyah'],  ['stick-to-the-script', 4, 'mathathyah'],
  ['blue-strip', 1, 'yashami'],
  ['room-144', 1, 'banayah'], ['room-144', 2, 'izarahla'], ['room-144', 3, 'ash'],
  ['deaconstruction', 1, 'shamaryah'],
  ['war-for-the-kingdom', 1, 'yahzeqel'],
  ['feed-the-sheep', 1, 'tazayawan']
];

var MIG_PAIRS = [
  ['bible-basics', 'shahad', 'uriahbenson'], ['bible-basics', 'mathathyah', 'iyanahrayahla'],
  ['bible-basics', 'raiyah', 'yashakar'], ['bible-basics', 'bayan', 'natazach'],
  ['bible-basics', 'ahmanahla', 'k.zakaya19'],
  ['stick-to-the-script', 'banayah', 'natazach'], ['stick-to-the-script', 'shahad', 'yaqataza'],
  ['stick-to-the-script', 'mathathyah', 'bayan'], ['stick-to-the-script', 'raiyah', 'yashakar'],
  ['room-144', 'banayah', 'mathathyah'], ['room-144', 'izarahla', 'shahad'],
  ['room-144', 'ash', 'ahmanahla'],
  ['los-discipulos', 'ash', 'malaakaya'], ['los-discipulos', 'malaakaya', 'ash']
];

var MIG_HEADERS = {
  classes: ['class_key','class_name','weekday','weeks','start_time','duration_min','teacher_mode',
            'topic_mode','reader_mode','fixed_reader_email','flag_missing_reader','postpone_default',
            'skip_consumes_turn','rotation_anchor_seq','rotation_anchor_position','active','display_order'],
  class_teachers: ['class_key','position','teacher_email','active'],
  topics: ['class_key','topic_id','topic_name','teach_order','scripture_refs','description','notes','retired'],
  reader_pairs: ['class_key','teacher_email','reader_email','active'],
  graphics_owners: ['class_key','designer_email','active'],
  sessions: ['session_id','class_key','date_iso','start_time','seq_no','topic_id','title','description',
             'anchor_scripture','teacher_email','reader_email','reader_source','image_file_id','thumb_file_id',
             'template_id','thumb_status','thumb_approved_by','thumb_approved_at','state','conflict_note',
             'pushed_from_date','push_batch_id','cal_event_teachers','cal_event_readers','cal_event_graphics',
             'cal_event_public','created_at','updated_by','updated_at','notified_48h_at'],
  config: ['key','value','note'],
  push_log: ['push_batch_id','class_key','made_by','made_at','from_date','sessions_moved','reversed_at','reversed_by']
};

var MIG_CONFIG = [
  ['timezone', 'America/Los_Angeles', 'Must match the script and spreadsheet timezone'],
  ['horizon_weeks', 16, 'How far ahead slots are generated'],
  ['claim_day', 10, 'Monthly: dates claimed by this day'],
  ['flag_day', 15, 'Monthly: titles, descriptions and scripture due - a flag date, not a lock'],
  ['publish_day', 20, 'Monthly: schedule published'],
  ['risk_hours', 48, 'Inside this many hours an incomplete session is At risk'],
  ['freeze_hours', 2, 'Title freezes this many hours before air'],
  ['feast_exclude_keywords', 'TN Monthly Alms Due', 'Comma separated; calendar titles to ignore when reading feast days'],
  ['cycle_started_on.bible-basics', '', 'A topic is Open if no session references it on or after this date'],
  ['cal_id_teachers', '', 'Set in step 7'],
  ['cal_id_readers', '', 'Set in step 7'],
  ['cal_id_graphics', '', 'Set in step 7'],
  ['cal_id_public', '', 'Set in step 7 - the public Classes calendar']
];

// ----------------------------- SELF-CONTAINED BASICS -----------------------------
// Deliberately duplicated from code.gs rather than shared: this file must work in any project.
var MIG_SPREADSHEET_ID = '1fmbURWbBGIFbWiUZubpY4_KR7RhnCZUGLZOsGHytoV0';
var MIG_ADMIN_GROUPS = ['tn-admin@truenation.org', 'apostles@truenation.org', 'bishops@truenation.org'];

function mig_me_() { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }

function mig_inGroup_(group, email) {
  if (!email) return false;
  if (typeof AdminDirectory !== 'undefined') {
    try { AdminDirectory.Members.get(group, email); return true; } catch (e) {}
  }
  try { return GroupsApp.getGroupByEmail(group).hasUser(email); } catch (e2) { return false; }
}

/** Admin only. If neither the Admin SDK nor GroupsApp can answer, it refuses rather than assume. */
function mig_assertAdmin_() {
  var email = mig_me_();
  for (var i = 0; i < MIG_ADMIN_GROUPS.length; i++) if (mig_inGroup_(MIG_ADMIN_GROUPS[i], email)) return;
  throw new Error('Admin access required. Signed in as: ' + (email || '(unknown)'));
}

/** A sheet date or a date-ish string as YYYY-MM-DD. */
function mig_fmtDate_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]')
    return v.getFullYear() + '-' + mig_pad_(v.getMonth() + 1) + '-' + mig_pad_(v.getDate());
  var p = String(v).split('-');
  return p.length === 3 ? p[0] + '-' + mig_pad_(Number(p[1])) + '-' + mig_pad_(Number(p[2])) : String(v);
}
function mig_pad_(n) { return (n < 10 ? '0' : '') + n; }

/** Header name -> column index for ANY tab. Throws if a required header is missing or doubled. */
function mig_headerMap_(headerRow, tab, required) {
  var map = {}, dup = {};
  headerRow.forEach(function (h, i) {
    var k = String(h == null ? '' : h).trim().toLowerCase();
    if (!k) return;
    if (k in map) dup[k] = true; else map[k] = i;
  });
  (required || []).forEach(function (n) {
    if (!(n in map)) throw new Error('Tab "' + tab + '" is missing column "' + n + '". Check its header row.');
    if (dup[n]) throw new Error('Tab "' + tab + '" has column "' + n + '" more than once.');
  });
  return map;
}

// What the migration needs from the tabs that exist today.
var MIG_OLD_REQUIRED = {
  bible_basics_topics: ['topic_id','topic_name','scripture_refs','description','claimed_by_email','teach_date'],
  world_history_topics: ['topic_id','topic_name','teach_order'],
  overrides: ['class_key','date_iso','teacher_email','topic_id','canceled','note']
};

var MIG_DOMAIN = '@truenation.org';
function mig_email_(local) { return local ? String(local).toLowerCase() + MIG_DOMAIN : ''; }

// ----------------------------- ENTRY POINTS -----------------------------

/** Admin only. Writes nothing. Logs exactly what migrationApply would do. */
function migrationPreview() { return mig_run_(false); }

/** Admin only. Creates the new tabs and fills them. Refuses if they already hold data. */
function migrationApply() { return mig_run_(true); }

function mig_run_(apply) {
  mig_assertAdmin_();
  var ss = SpreadsheetApp.openById(MIG_SPREADSHEET_ID);
  var log = [], warn = [];
  var plan = mig_build_(ss, warn);

  var blocked = mig_blocked_(ss);
  if (blocked.length) {
    var msg = 'REFUSED - these tabs already hold data: ' + blocked.join(', ') +
              '. Delete them, or the migration has already run.';
    Logger.log(msg); return msg;
  }

  log.push(apply ? 'APPLY' : 'PREVIEW (nothing written)');
  ['classes','class_teachers','topics','reader_pairs','graphics_owners','sessions','config','push_log']
    .forEach(function (tab) {
      var rows = plan[tab] || [];
      log.push('  ' + tab + ': ' + rows.length + ' rows + header');
      if (apply) mig_write_(ss, tab, rows);
    });
  log.push('  unchanged: bible_basics_topics, world_history_topics, class_config, overrides');
  if (warn.length) log.push('WARNINGS:'); warn.forEach(function (w) { log.push('  ! ' + w); });
  if (apply) {
    SpreadsheetApp.flush();
    log.push('Done. Check the new tabs before anything reads them. Rollback: delete the new tabs.');
  } else {
    log.push('Nothing was written. Run migrationApply() to write it.');
  }
  var out = log.join('\n'); Logger.log(out); return out;
}

// ----------------------------- BUILD (pure, no writes) -----------------------------

function mig_build_(ss, warn) {
  var plan = {};

  plan.classes = MIG_CLASSES.map(function (c) {
    return [c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], mig_email_(c[9]),
            c[10], c[11], c[12], '', '', true, c[13]];
  });
  plan.class_teachers = MIG_TEACHERS.map(function (t) { return [t[0], t[1], mig_email_(t[2]), true]; });
  plan.reader_pairs = MIG_PAIRS.map(function (p) { return [p[0], mig_email_(p[1]), mig_email_(p[2]), true]; });
  plan.graphics_owners = [];   // Shahad assigns designers after the build
  plan.push_log = [];
  plan.config = MIG_CONFIG.map(function (r) { return [r[0], r[1], r[2]]; });

  // ---- topics: both catalogues, by header name, with a class_key ----
  var topics = [];
  MIG_CLASSES.forEach(function (c) {
    var src = mig_sourceTab_(c[0]);
    if (!src) return;
    var sheet = ss.getSheetByName(src);
    if (!sheet) { warn.push('source tab "' + src + '" not found'); return; }
    var data = sheet.getDataRange().getValues();
    var K = mig_headerMap_(data[0], src, MIG_OLD_REQUIRED[src]);
    var idx = function (name) { return (name in K) ? K[name] : -1; };
    var order = idx('teach_order'), notes = idx('notes');
    for (var i = 1; i < data.length; i++) {
      var r = data[i], id = String(r[K.topic_id] || '').trim();
      if (!id) continue;
      topics.push([c[0], id, r[K.topic_name] || '', order >= 0 ? r[order] : '',
                   r[idx('scripture_refs')] || '', r[idx('description')] || '',
                   notes >= 0 ? (r[notes] || '') : '', false]);
    }
  });
  plan.topics = topics;

  // ---- sessions: existing Bible Basics claims, plus every overrides row ----
  var byKey = {}, orderKeys = [];
  function slot(classKey, dateISO) {
    var k = classKey + '|' + dateISO;
    if (!byKey[k]) {
      byKey[k] = { class_key: classKey, date_iso: dateISO, topic_id: '', teacher: '', state: 'scheduled', note: '' };
      orderKeys.push(k);
    }
    return byKey[k];
  }

  MIG_CLASSES.forEach(function (c) {
    if (c[7] !== 'claim') return;
    var src = mig_sourceTab_(c[0]), sheet = ss.getSheetByName(src);
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    var K = mig_headerMap_(data[0], src, MIG_OLD_REQUIRED[src]);
    for (var i = 1; i < data.length; i++) {
      var r = data[i], id = String(r[K.topic_id] || '').trim();
      if (!id) continue;
      var d = mig_fmtDate_(r[K.teach_date]), email = String(r[K.claimed_by_email] || '').toLowerCase();
      if (!d && !email) continue;
      if (!d) { warn.push('claim on "' + id + '" by ' + email + ' has no teach_date - not migrated'); continue; }
      var s = slot(c[0], d);
      if (s.topic_id && s.topic_id !== id) warn.push('two topics claim ' + c[0] + ' on ' + d + ': ' + s.topic_id + ' and ' + id);
      s.topic_id = id; s.teacher = email;
    }
  });

  var ovSheet = ss.getSheetByName('overrides');
  if (ovSheet) {
    var ov = ovSheet.getDataRange().getValues();
    var V = mig_headerMap_(ov[0], 'overrides', MIG_OLD_REQUIRED.overrides);
    for (var j = 1; j < ov.length; j++) {
      var o = ov[j], ck = String(o[V.class_key] || '').trim();
      if (!ck) continue;
      var od = mig_fmtDate_(o[V.date_iso]);
      if (!od) { warn.push('overrides row ' + (j + 1) + ' has no date - skipped'); continue; }
      if (!mig_known_(ck)) { warn.push('overrides row ' + (j + 1) + ' names unknown class "' + ck + '" - skipped'); continue; }
      var s2 = slot(ck, od);
      if (o[V.topic_id]) s2.topic_id = String(o[V.topic_id]);
      if (o[V.teacher_email]) s2.teacher = String(o[V.teacher_email]).toLowerCase();
      if (String(o[V.canceled]).toLowerCase() === 'true') s2.state = 'skipped';
      if (o[V.note]) s2.note = String(o[V.note]);
    }
  }

  var now = new Date(), me = mig_me_();
  plan.sessions = orderKeys.sort().map(function (k) {
    var s = byKey[k], c = mig_class_(s.class_key);
    var reader = mig_reader_(s.class_key, s.teacher);
    return [s.class_key + '-' + s.date_iso, s.class_key, s.date_iso, c ? c[4] : '', '',
            s.topic_id, '', '', '', s.teacher, reader.email, reader.source,
            '', '', '', '', '', '', s.state, s.note, '', '', '', '', '', '',
            now, me, now, ''];
  });
  return plan;
}

// ----------------------------- HELPERS -----------------------------

/** The old catalogue tab a class's topics come from, or '' if it has none. */
function mig_sourceTab_(classKey) {
  if (classKey === 'bible-basics') return 'bible_basics_topics';
  if (classKey === 'world-history') return 'world_history_topics';
  return '';
}
function mig_class_(classKey) {
  for (var i = 0; i < MIG_CLASSES.length; i++) if (MIG_CLASSES[i][0] === classKey) return MIG_CLASSES[i];
  return null;
}
function mig_known_(classKey) { return !!mig_class_(classKey); }

/** Reader at migration time: fixed reader, else the pair table, else empty. */
function mig_reader_(classKey, teacherEmail) {
  var c = mig_class_(classKey);
  if (!c) return { email: '', source: '' };
  if (c[8] === 'fixed') return { email: mig_email_(c[9]), source: 'fixed' };
  if (c[8] === 'pair' && teacherEmail) {
    for (var i = 0; i < MIG_PAIRS.length; i++) {
      if (MIG_PAIRS[i][0] === classKey && mig_email_(MIG_PAIRS[i][1]) === teacherEmail)
        return { email: mig_email_(MIG_PAIRS[i][2]), source: 'pair' };
    }
  }
  return { email: '', source: '' };
}

/** Header lookup for a new tab, requiring every column this file writes. */
function mig_cols_(headerRow, tab) { return mig_headerMap_(headerRow, tab, MIG_HEADERS[tab]); }

/** Target tabs that already hold data rows. A tab with only a header is fine to fill. */
function mig_blocked_(ss) {
  var out = [];
  Object.keys(MIG_HEADERS).forEach(function (tab) {
    var s = ss.getSheetByName(tab);
    if (s && s.getLastRow() > 1) out.push(tab);
  });
  return out;
}

/** Create the tab if missing, write the header, then the rows. Never touches other tabs. */
function mig_write_(ss, tab, rows) {
  var headers = MIG_HEADERS[tab];
  var s = ss.getSheetByName(tab) || ss.insertSheet(tab);
  s.getRange(1, 1, 1, headers.length).setValues([headers]);
  s.setFrozenRows(1);
  if (rows.length) s.getRange(2, 1, rows.length, headers.length).setValues(rows);
  return s;
}

/**
 * Admin only. Read-back check to run AFTER migrationApply: counts the new tabs against
 * the old ones and reports anything that does not line up.
 */
function migrationVerify() {
  mig_assertAdmin_();
  var ss = SpreadsheetApp.openById(MIG_SPREADSHEET_ID), out = [], bad = 0;
  function count(tab, keyCol) {
    var s = ss.getSheetByName(tab);
    if (!s) return -1;
    var d = s.getDataRange().getValues();
    if (d.length < 2) return 0;
    var K = mig_headerMap_(d[0], tab, MIG_HEADERS[tab] || [keyCol]);
    var k = K[keyCol], n = 0;
    for (var i = 1; i < d.length; i++) if (String(d[i][k] || '').trim()) n++;
    return n;
  }
  function line(ok, text) { if (!ok) bad++; out.push((ok ? 'OK    ' : 'FAIL  ') + text); }

  var bb = count('bible_basics_topics', 'topic_id'), wh = count('world_history_topics', 'topic_id');
  var tp = count('topics', 'topic_id');
  line(tp === bb + wh, 'topics: ' + tp + ' = bible_basics ' + bb + ' + world_history ' + wh);
  line(count('classes', 'class_key') === MIG_CLASSES.length, 'classes: ' + count('classes', 'class_key') + ' of ' + MIG_CLASSES.length);
  line(count('class_teachers', 'class_key') === MIG_TEACHERS.length, 'class_teachers: ' + count('class_teachers', 'class_key') + ' of ' + MIG_TEACHERS.length);
  line(count('reader_pairs', 'class_key') === MIG_PAIRS.length, 'reader_pairs: ' + count('reader_pairs', 'class_key') + ' of ' + MIG_PAIRS.length);

  // every session is one class+date, and both are known
  var s = ss.getSheetByName('sessions'), seen = {}, dup = 0, unknown = 0, n = 0;
  if (s) {
    var d = s.getDataRange().getValues(), K = mig_cols_(d[0], 'sessions');
    for (var i = 1; i < d.length; i++) {
      var ck = String(d[i][K.class_key] || '').trim();
      if (!ck) continue;
      n++;
      var key = ck + '|' + mig_fmtDate_(d[i][K.date_iso]);
      if (seen[key]) dup++; seen[key] = true;
      if (!mig_known_(ck)) unknown++;
    }
  }
  line(dup === 0, 'sessions: ' + n + ' rows, ' + dup + ' duplicate class+date');
  line(unknown === 0, 'sessions: ' + unknown + ' rows naming an unknown class');
  line(count('config', 'key') === MIG_CONFIG.length, 'config: ' + count('config', 'key') + ' of ' + MIG_CONFIG.length);

  var report = out.join('\n') + '\n' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed');
  Logger.log(report);
  return report;
}
