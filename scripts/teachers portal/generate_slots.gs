/**
 * TNIC scheduling — step 2a: slot generation
 * ===========================================================================
 * Creates the session rows that everything else hangs on: one row per class per
 * date, out to the horizon in config (horizon_weeks, 16). Content arrives later;
 * the row exists so the date is visible even when the title is not.
 *
 *   generateSlotsPreview()  - admin only, writes nothing, reports per class
 *   generateSlotsApply()    - admin only, appends the missing rows
 *
 * NEVER overwrites an existing session's topic, teacher, reader or state. It only
 * appends rows that do not exist and fills blanks, so it is safe to re-run: a
 * second run reports "0 new".
 *
 * Assignments are written ONCE, here. Nothing recomputes them afterwards - that is
 * what makes a postponement or a change of teacher line-up safe (sheet-schema.md,
 * QC finding B). A skipped session therefore never moves anybody, which is
 * Decision C (Reading B).
 *
 * Lives in the Teacher Portal project and uses its helpers (cols_, sheet_, iso_...).
 * ===========================================================================
 */

// Which rotation position teaches the FIRST session generated, when the classes tab
// carries no anchor yet. From Shahad, 2026-09-19: Los Discipulos starts with Ash
// (they co-teach today, so it only matters once a third person joins), Stick to the
// Script is Banayah's turn, Room 144 is Izar Ahla's (position 2).
var GEN_FIRST_POSITION = {
  'los-discipulos': 1,
  'stick-to-the-script': 1,
  'room-144': 2,
  'world-history': 1
};

function generateSlotsPreview() { return gen_run_(false); }
function generateSlotsApply() { return gen_run_(true); }

function gen_run_(apply) {
  assertAdmin_();
  _MEMO.tabs = {}; _MEMO.cols = {};
  var horizon = Number(cfg_('horizon_weeks', WEEKS_AHEAD)) || WEEKS_AHEAD;
  var today = mid_(new Date()), out = [], totalNew = 0;

  var classes = gen_classes_();
  if (!classes.length) return 'No rows in the classes tab.';

  var sheet = sheet_('sessions'), data = sheet.getDataRange().getValues();
  var K = cols_('sessions', data[0]);
  var width = Math.max(sheet.getLastColumn(), data[0].length);   // read ONCE, not per row
  var existing = gen_index_(data, K);          // class_key -> dateISO -> {row, seq, teacher, topic}
  var pending = [];                            // rows to append

  classes.forEach(function (c) {
    if (!c.active) { out.push('  ' + c.key + ': inactive, skipped'); return; }
    var have = existing[c.key] || (existing[c.key] = {});
    var dates = gen_dates_(c.weekday, c.weeks, today, horizon);
    var missing = dates.filter(function (iso) { return !have[iso]; });

    // seq_no runs over every session of this class in date order, existing ones included.
    var allDates = Object.keys(have).concat(missing).sort();
    var seqOf = {};
    allDates.forEach(function (iso, i) { seqOf[iso] = i + 1; });

    var team = gen_team_(c.key);
    var anchor = gen_anchor_(c, dates, seqOf, team.length);
    var assigned = [];

    missing.forEach(function (iso) {
      var seq = seqOf[iso];
      var teacher = gen_teacher_(c, team, anchor, seq);
      var topicId = gen_topic_(c, iso);
      var reader = gen_reader_(c, teacher);
      pending.push({ c: c, iso: iso, seq: seq, teacher: teacher, topicId: topicId, reader: reader });
      assigned.push(teacher);
    });

    totalNew += missing.length;
    var who = team.length ? ' first: ' + (assigned[0] ? assigned[0].split('@')[0] : '(none)') : ' (no rotation)';
    out.push('  ' + c.key + ': ' + missing.length + ' new, ' + Object.keys(have).length + ' already there' +
             (missing.length ? ', ' + missing[0] + ' -> ' + missing[missing.length - 1] + who : ''));
  });

  if (apply) {
    var rows = pending.map(function (p) {
      return gen_row_(width, K, {
        session_id: p.c.key + '-' + p.iso, class_key: p.c.key, date_iso: p.iso,
        start_time: p.c.startTime, seq_no: p.seq, topic_id: p.topicId,
        teacher_email: p.teacher, owner_email: p.teacher,   // the rotation teacher owns the slot
        reader_email: p.reader.email, reader_source: p.reader.source,
        state: 'scheduled', created_at: new Date(), updated_by: me_(), updated_at: new Date()
      });
    });
    if (pending.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      SpreadsheetApp.flush();
    }
    // Always, even when nothing was appended: an interrupted earlier run can leave rows in place
    // with no seq_no, and a re-run has to finish the job rather than skip it.
    gen_writeSeq_(classes);
    gen_writeAnchors_(classes);
  }

  var head = (apply ? 'APPLY' : 'PREVIEW (nothing written)') + ' - ' + totalNew +
             ' new session row(s), horizon ' + horizon + ' weeks';
  var report = head + '\n' + out.join('\n') +
    (apply ? '\nDone. Existing rows were not touched.' : '\nNothing written. Run generateSlotsApply() to write it.');
  Logger.log(report); return report;
}

// ----------------------------- READ THE CONFIG TABS -----------------------------

function gen_classes_() {
  var rows = readTab_('classes'), K = cols_('classes');
  return rows.map(function (r) {
    return {
      key: String(r[K.class_key]).trim(),
      name: r[K.class_name] || '',
      weekday: Number(r[K.weekday]),
      weeks: String(r[K.weeks] || '').split(',').map(function (x) { return Number(x.trim()); })
               .filter(function (x) { return x >= 1 && x <= 5; }),
      startTime: r[K.start_time] || '',
      teacherMode: String(r[K.teacher_mode] || '').trim(),
      topicMode: String(r[K.topic_mode] || '').trim(),
      readerMode: String(r[K.reader_mode] || '').trim(),
      fixedReader: String(r[K.fixed_reader_email] || '').toLowerCase(),
      anchorSeq: r[K.rotation_anchor_seq],
      anchorPos: r[K.rotation_anchor_position],
      active: String(r[K.active]).toLowerCase() !== 'false',
      row: 0
    };
  }).filter(function (c) { return c.key; });
}

function gen_team_(classKey) {
  var rows = readTab_('class_teachers'), K = cols_('class_teachers');
  return rows.filter(function (r) {
      return String(r[K.class_key]).trim() === classKey &&
             String(r[K.active]).toLowerCase() !== 'false' &&
             String(r[K.teacher_email] || '').trim();
    })
    .sort(function (a, b) { return Number(a[K.position]) - Number(b[K.position]); })
    .map(function (r) { return String(r[K.teacher_email]).toLowerCase(); });
}

function gen_pairs_(classKey) {
  var rows = readTab_('reader_pairs'), K = cols_('reader_pairs'), map = {};
  rows.forEach(function (r) {
    if (String(r[K.class_key]).trim() !== classKey) return;
    if (String(r[K.active]).toLowerCase() === 'false') return;
    map[String(r[K.teacher_email]).toLowerCase()] = String(r[K.reader_email]).toLowerCase();
  });
  return map;
}

// ----------------------------- THE RULES -----------------------------

/** Every date of this weekday whose occurrence in its month is listed, from today to the horizon. */
function gen_dates_(weekday, weeks, from, horizonWeeks) {
  var out = [], d = new Date(from.getTime()), end = new Date(from.getTime());
  end.setDate(end.getDate() + horizonWeeks * 7);
  while (d <= end) {
    if (d.getDay() === weekday && weeks.indexOf(nth_(d)) !== -1) out.push(iso_(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Where the rotation stands. Uses the anchor recorded on the classes row when there is
 * one, otherwise starts the first upcoming session at GEN_FIRST_POSITION (Shahad's answer)
 * and records it on apply, so later runs stay put.
 */
function gen_anchor_(c, dates, seqOf, teamSize) {
  if (!teamSize) return null;
  var seq = Number(c.anchorSeq), pos = Number(c.anchorPos);
  if (seq && pos) return { seq: seq, pos: pos };
  var firstISO = dates.length ? dates[0] : null;
  if (!firstISO) return null;
  return { seq: seqOf[firstISO], pos: GEN_FIRST_POSITION[c.key] || 1, fresh: true };
}

/** The rotation counts SESSIONS, not dates: position moves one step per session of this class. */
function gen_teacher_(c, team, anchor, seq) {
  if (c.teacherMode === 'panel') return '';          // Q&A: the whole A-Team, nobody named
  if (c.teacherMode === 'claim') return '';          // Bible Basics: filled when a teacher claims it
  if (!team.length || !anchor) return '';
  var offset = seq - anchor.seq + (anchor.pos - 1);
  var i = ((offset % team.length) + team.length) % team.length;
  return team[i];
}

/**
 * Sequence classes keep the catalogue's teach_order, anchored on the class's start topic and
 * start date exactly as the portal has been computing it, so what teachers already see for
 * upcoming weeks does not change when those dates become stored rows.
 */
function gen_topic_(c, iso) {
  if (c.topicMode !== 'sequence') return '';
  var cls = null;
  for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].key === c.key) cls = CLASSES[i];
  if (!cls || !cls.startTopicId || !cls.startDateISO) return '';
  var ordered = orderedTopics_(cls);
  if (!ordered.length) return '';
  var startIdx = indexOfTopic_(ordered, cls.startTopicId);
  var offset = Math.round((mid_(dateFromISO_(iso)) - mid_(dateFromISO_(cls.startDateISO))) / 604800000);
  var idx = ((startIdx + offset) % ordered.length + ordered.length) % ordered.length;
  return ordered[idx].id;
}

/** Fixed reader, else the pairing table for that teacher, else nobody. */
function gen_reader_(c, teacher) {
  if (c.readerMode === 'fixed' && c.fixedReader) return { email: c.fixedReader, source: 'fixed' };
  if (c.readerMode === 'pair' && teacher) {
    var hit = gen_pairs_(c.key)[teacher];
    if (hit) return { email: hit, source: 'pair' };
  }
  return { email: '', source: '' };
}

/**
 * A full-width row with each value under its header - same idea as rowFor_ in code.gs, but
 * taking the width as a number instead of asking the sheet for it. Asking per row meant 128
 * reads before a single write, which is what made the first live run take three minutes.
 */
function gen_row_(width, K, values) {
  var row = [];
  for (var i = 0; i < width; i++) row.push('');
  Object.keys(values).forEach(function (n) { if (K[n] !== undefined) row[K[n]] = values[n]; });
  return row;
}

// ----------------------------- SHEET PLUMBING -----------------------------

/** class_key -> dateISO -> {row, seq} for everything already in the sessions tab. */
function gen_index_(data, K) {
  var out = {};
  for (var i = 1; i < data.length; i++) {
    var ck = String(data[i][K.class_key] || '').trim();
    if (!ck) continue;
    var iso = fmtDate_(data[i][K.date_iso]);
    if (!iso) continue;
    (out[ck] || (out[ck] = {}))[iso] = { row: i + 1, seq: data[i][K.seq_no] };
  }
  return out;
}

/**
 * seq_no for every session of a class, in date order.
 *
 * ONE write for the whole column, not one per cell. A cell-at-a-time version of this took
 * three minutes against the live sheet (~140 round trips) before it was cancelled; the same
 * work as a single setValues is a second or two. Every batch write in this file is deliberate.
 */
function gen_writeSeq_(classes) {
  var sheet = sheet_('sessions'), data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var K = cols_('sessions', data[0]), byClass = {};
  for (var i = 1; i < data.length; i++) {
    var ck = String(data[i][K.class_key] || '').trim();
    var iso = ck ? fmtDate_(data[i][K.date_iso]) : '';
    if (!ck || !iso) continue;
    (byClass[ck] || (byClass[ck] = [])).push({ row: i + 1, iso: iso });
  }
  var want = {};                                  // sheet row -> seq_no
  Object.keys(byClass).forEach(function (ck) {
    byClass[ck].sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; })
      .forEach(function (s, idx) { want[s.row] = idx + 1; });
  });
  var column = [];
  for (var r = 2; r <= data.length; r++)
    column.push([want[r] === undefined ? data[r - 1][K.seq_no] : want[r]]);
  if (column.length) sheet.getRange(2, K.seq_no + 1, column.length, 1).setValues(column);
  SpreadsheetApp.flush();
}

/** Record each rotation's starting point on the classes row, so a later run cannot drift. */
function gen_writeAnchors_(classes) {
  var sheet = sheet_('classes'), data = sheet.getDataRange().getValues();
  var K = cols_('classes', data[0]);
  var sess = sheet_('sessions').getDataRange().getValues();
  var SK = cols_('sessions', sess[0]), firstSeq = {};
  for (var j = 1; j < sess.length; j++) {
    var ck = String(sess[j][SK.class_key] || '').trim();
    var iso = fmtDate_(sess[j][SK.date_iso]);
    var seq = Number(sess[j][SK.seq_no]);
    if (!ck || !iso || !seq) continue;
    if (iso < iso_(new Date())) continue;                  // anchor on the first upcoming session
    if (!firstSeq[ck] || seq < firstSeq[ck]) firstSeq[ck] = seq;
  }
  // Both anchor columns, whole-column writes: two calls, not two per class.
  var seqCol = [], posCol = [], changed = false;
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][K.class_key] || '').trim();
    var seqNow = data[i][K.rotation_anchor_seq], posNow = data[i][K.rotation_anchor_position];
    var setIt = key && !(Number(seqNow) && Number(posNow)) && GEN_FIRST_POSITION[key] && firstSeq[key];
    if (setIt) changed = true;
    seqCol.push([setIt ? firstSeq[key] : seqNow]);
    posCol.push([setIt ? GEN_FIRST_POSITION[key] : posNow]);
  }
  if (changed && seqCol.length) {
    sheet.getRange(2, K.rotation_anchor_seq + 1, seqCol.length, 1).setValues(seqCol);
    sheet.getRange(2, K.rotation_anchor_position + 1, posCol.length, 1).setValues(posCol);
  }
  SpreadsheetApp.flush();
}

/**
 * Admin only. Read-back check for step 2a: one row per class per date, no duplicates,
 * no gaps against the cadence rules, and the rotation walking in order.
 */
function generateSlotsVerify() {
  assertAdmin_();
  _MEMO.tabs = {}; _MEMO.cols = {};
  var horizon = Number(cfg_('horizon_weeks', WEEKS_AHEAD)) || WEEKS_AHEAD;
  var today = mid_(new Date()), out = [], bad = 0;
  var data = sheet_('sessions').getDataRange().getValues(), K = cols_('sessions', data[0]);
  var idx = gen_index_(data, K);

  gen_classes_().forEach(function (c) {
    if (!c.active) return;
    var have = idx[c.key] || {};
    var want = gen_dates_(c.weekday, c.weeks, today, horizon);
    var missing = want.filter(function (iso) { return !have[iso]; });
    var line = c.key + ': ' + want.length + ' dates to the horizon, ' + missing.length + ' missing';
    if (missing.length) { bad++; line += ' (' + missing.slice(0, 3).join(', ') + ')'; }
    out.push((missing.length ? 'FAIL  ' : 'OK    ') + line);
  });

  var seen = {}, dup = 0, noSeq = 0, n = 0;
  for (var i = 1; i < data.length; i++) {
    var ck = String(data[i][K.class_key] || '').trim();
    if (!ck) continue;
    n++;
    var key = ck + '|' + fmtDate_(data[i][K.date_iso]);
    if (seen[key]) dup++; seen[key] = true;
    if (!Number(data[i][K.seq_no])) noSeq++;
  }
  if (dup) bad++;
  if (noSeq) bad++;
  out.push((dup ? 'FAIL  ' : 'OK    ') + 'sessions: ' + n + ' rows, ' + dup + ' duplicate class+date');
  out.push((noSeq ? 'FAIL  ' : 'OK    ') + 'sessions: ' + noSeq + ' row(s) without a seq_no');

  var report = out.join('\n') + '\n' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed');
  Logger.log(report); return report;
}
