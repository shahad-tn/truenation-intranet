/**
 * TNIC scheduling - step 2b: empty calendar events
 * ===========================================================================
 * One event per upcoming session on each of the four class calendars, created
 * EMPTY: the class name, the date and time, and (staff calendars only) a link to
 * the session's portal page. Titles, teachers and readers are filled in later by
 * the step 7 sync, which reuses ev_render_ below so the two can never disagree.
 *
 *   setCalendarIds()        - admin only, writes the four calendar ids into config
 *   createEventsPreview()   - admin only, writes nothing, reports per calendar
 *   createEventsApply()     - admin only, creates the missing events, stores their ids
 *   createEventsVerify()    - admin only, read-back check
 *
 * Which calendar gets which sessions (Shahad, 2026-09-25):
 *   Teachers  every class
 *   Readers   every class that has a reader (not Q&A, not Feed The Sheep: reader_mode none)
 *   Graphics  every class except Q&A
 *   Public    every class
 * Only sessions from today onward, and never a 'skipped' one.
 *
 * SAFE TO RE-RUN. It never touches an event whose id is already stored, and never
 * creates a second event for a session. Every event is tagged with its session_id,
 * so if a run dies between creating an event and saving its id, the next run finds
 * the tagged event and adopts it instead of creating a duplicate.
 *
 * RESUMABLE. ~500 events will not fit in one 6-minute Apps Script run. Each run
 * stops itself after EV_BUDGET_MS and says how many are left; run it again.
 *
 * NO LONG LOCK. Ids are saved every EV_FLUSH_EVERY events, each time under the
 * script lock and against a FRESH read of the sessions tab, matched by session_id.
 * The portal can keep writing during a run, and a row that moved still gets its id.
 *
 * Lives in the Teacher Portal project and uses its helpers (cols_, sheet_, cfg_...).
 * ===========================================================================
 */

var EV_PORTAL = 'https://portal.truenation.org/portal/classes/';
var EV_TAG = 'tn_session_id';
var EV_BUDGET_MS = 270000;        // 4.5 minutes of the 6-minute limit
var EV_FLUSH_EVERY = 20;          // ids saved to the sheet this often
var EV_TZ = 'America/Los_Angeles';

var EV_CALS = [
  { role: 'teachers', cfg: 'cal_id_teachers', col: 'cal_event_teachers', label: 'Teachers' },
  { role: 'readers',  cfg: 'cal_id_readers',  col: 'cal_event_readers',  label: 'Readers' },
  { role: 'graphics', cfg: 'cal_id_graphics', col: 'cal_event_graphics', label: 'Graphics' },
  { role: 'public',   cfg: 'cal_id_public',   col: 'cal_event_public',   label: 'Public Classes' }
];

// Every class needs a thumbnail except Q&A (Shahad, 2026-09-25).
var EV_GRAPHICS_SKIP = ['qa-on-the-spot-a-team'];

// Used ONLY by setCalendarIds(). At run time the ids are read from the config tab.
var EV_CALENDAR_IDS = {
  cal_id_teachers: 'c_9b209f6c75a63b3a2311e226d3de7024544530431629089617b2cfba8823fe72@group.calendar.google.com',
  cal_id_readers:  'c_30f8f2961f68629061c5152bbb1982a8d1e1c735c0c376592a52872b417a8a87@group.calendar.google.com',
  cal_id_graphics: 'c_fdd7b951d94adf843ba87f81f9da54613ca4e2e260a126efaf3c9dae7c6afe2b@group.calendar.google.com',
  cal_id_public:   'c_85c7267c2722d696fbf37ffba64d4c5f40156e85002a88affa960ba56f71018a@group.calendar.google.com'
};

function createEventsPreview() { return ev_run_(false); }
function createEventsApply()   { return ev_run_(true); }

/** The clock, as a function so the tests can move it. */
function ev_now_() { return new Date().getTime(); }

// ----------------------------- CONFIG -----------------------------

/** Admin only. Puts the four calendar ids into the config tab. Re-running changes nothing. */
function setCalendarIds() {
  assertAdmin_();
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    _MEMO.tabs = {}; _MEMO.cols = {};
    var sheet = sheet_('config'), data = sheet.getDataRange().getValues();
    var K = cols_('config', data[0]), out = [], changed = false, add = [];
    var width = data[0].length;
    Object.keys(EV_CALENDAR_IDS).forEach(function (key) {
      var want = EV_CALENDAR_IDS[key], found = false;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][K.key]).trim() !== key) continue;
        found = true;
        var now = String(data[i][K.value] || '').trim();
        if (now === want) { out.push('  ' + key + ': already set'); }
        else { data[i][K.value] = want; changed = true; out.push('  ' + key + ': ' + (now ? 'CHANGED from ' + now : 'set')); }
      }
      if (!found) {
        var row = []; for (var j = 0; j < width; j++) row.push('');
        row[K.key] = key; row[K.value] = want; row[K.note] = 'Class calendar (step 2b)';
        add.push(row); out.push('  ' + key + ': added');
      }
    });
    if (changed) sheet.getRange(2, K.value + 1, data.length - 1, 1)
      .setValues(data.slice(1).map(function (r) { return [r[K.value]]; }));
    if (add.length) sheet.getRange(data.length + 1, 1, add.length, width).setValues(add);
    SpreadsheetApp.flush();
    var report = 'Calendar ids in config:\n' + out.join('\n');
    Logger.log(report); return report;
  } finally { lock.releaseLock(); }
}

// ----------------------------- THE RULES -----------------------------

/** Does this calendar carry this class at all? */
function ev_wants_(role, c) {
  if (role === 'readers') return c.readerMode !== 'none';
  if (role === 'graphics') return EV_GRAPHICS_SKIP.indexOf(c.key) === -1;
  return true;
}

/**
 * What an event says. ONE place, used by step 2b now and by the step 7 sync later.
 * Empty events carry no names, so nothing here depends on how a name is resolved.
 * The public calendar is world-readable: class name and time only, no link, no names.
 */
function ev_render_(role, c, s) {
  var title = c.name || c.key;
  if (role === 'public') return { title: title, description: '' };
  return {
    title: title,
    description: 'Session page (teacher, reader, title and details):\n' +
                 EV_PORTAL + encodeURIComponent(c.key) + '/' + s.iso
  };
}

/** "19:30", "7:30 pm" or a Sheets time value -> {h, m}; null when it cannot be read. */
function ev_time_(v) {
  if (v instanceof Date) return { h: v.getHours(), m: v.getMinutes() };
  var t = String(v == null ? '' : v).trim().toLowerCase();
  var mt = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!mt) return null;
  var h = Number(mt[1]), m = Number(mt[2]);
  if (mt[3] === 'pm' && h < 12) h += 12;
  if (mt[3] === 'am' && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  return { h: h, m: m };
}

// ----------------------------- READ -----------------------------

function ev_classes_() {
  var rows = readTab_('classes'), K = cols_('classes'), out = {};
  ev_requireCols_('classes', K, ['duration_min']);
  rows.forEach(function (r) {
    var key = String(r[K.class_key]).trim();
    if (!key) return;
    out[key] = {
      key: key, name: String(r[K.class_name] || '').trim(),
      startTime: r[K.start_time], duration: Number(r[K.duration_min]) || 90,
      readerMode: String(r[K.reader_mode] || '').trim(),
      active: String(r[K.active]).toLowerCase() !== 'false'
    };
  });
  return out;
}

function ev_requireCols_(tab, K, names) {
  names.forEach(function (n) {
    if (K[n] === undefined) throw new Error('Tab "' + tab + '" is missing column "' + n + '". Check its header row.');
  });
}

/** The spreadsheet and the script must both run on Pacific time, or dates drift at the edges. */
function ev_checkTimezone_() {
  var script = Session.getScriptTimeZone();
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSpreadsheetTimeZone();
  if (script !== EV_TZ || sheet !== EV_TZ)
    throw new Error('Timezone mismatch: script is ' + script + ', spreadsheet is ' + sheet +
                    '. Both must be ' + EV_TZ + ' before any event is created.');
}

/**
 * Everything the calendars are missing. One read of the sessions tab.
 * Returns { tasks: [...], counts: {role: {want, have, todo}}, problems: [...] }
 */
function ev_plan_(data, K, classes, todayISO) {
  var tasks = [], counts = {}, problems = [];
  EV_CALS.forEach(function (cal) { counts[cal.role] = { want: 0, have: 0, todo: 0 }; });
  for (var i = 1; i < data.length; i++) {
    var ck = String(data[i][K.class_key] || '').trim();
    var iso = ck ? fmtDate_(data[i][K.date_iso]) : '';
    if (!ck || !iso || iso < todayISO) continue;
    if (String(data[i][K.state] || '').trim() === 'skipped') continue;
    var c = classes[ck];
    if (!c) { problems.push(ck + ' ' + iso + ': class not in the classes tab'); continue; }
    if (!c.active) continue;
    var tm = ev_time_(data[i][K.start_time]) || ev_time_(c.startTime);
    if (!tm) { problems.push(ck + ' ' + iso + ': start time "' + (data[i][K.start_time] || c.startTime) + '" unreadable'); continue; }
    var d = dateFromISO_(iso);
    var start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), tm.h, tm.m);
    var end = new Date(start.getTime() + c.duration * 60000);
    var sid = String(data[i][K.session_id] || '').trim() || (ck + '-' + iso);
    EV_CALS.forEach(function (cal) {
      if (!ev_wants_(cal.role, c)) return;
      counts[cal.role].want++;
      if (String(data[i][K[cal.col]] || '').trim()) { counts[cal.role].have++; return; }
      counts[cal.role].todo++;
      tasks.push({ sid: sid, iso: iso, c: c, cal: cal, start: start, end: end });
    });
  }
  return { tasks: tasks, counts: counts, problems: problems };
}

/** Each calendar, opened once. A missing id or no access stops the run before anything is created. */
function ev_openCalendars_() {
  var out = {};
  EV_CALS.forEach(function (cal) {
    var id = String(cfg_(cal.cfg, '') || '').trim();
    if (!id) throw new Error('config has no ' + cal.cfg + '. Run setCalendarIds() first.');
    var g = CalendarApp.getCalendarById(id);
    if (!g) throw new Error('Cannot open the ' + cal.label + ' calendar (' + id + '). Share it with ' +
                            me_() + ' at "Make changes to events", then run again.');
    out[cal.role] = g;
  });
  return out;
}

/**
 * Events already on each calendar that carry our tag, keyed by session_id -> [event].
 * ONE getEvents per calendar for the whole window, not one lookup per session.
 */
function ev_tagged_(cals, from, to) {
  var out = {};
  EV_CALS.forEach(function (cal) {
    var map = out[cal.role] = {};
    cals[cal.role].getEvents(from, to).forEach(function (e) {
      var sid = e.getTag(EV_TAG);
      if (sid) (map[sid] || (map[sid] = [])).push(e);
    });
  });
  return out;
}

function ev_window_(todayISO) {
  var horizon = Number(cfg_('horizon_weeks', WEEKS_AHEAD)) || WEEKS_AHEAD;
  var from = dateFromISO_(todayISO), to = new Date(from.getTime());
  to.setDate(to.getDate() + horizon * 7 + 8);   // past the horizon, so nothing at the edge is missed
  return { from: from, to: to };
}

// ----------------------------- RUN -----------------------------

function ev_run_(apply) {
  assertAdmin_();
  var t0 = ev_now_();
  _MEMO.tabs = {}; _MEMO.cols = {};
  ev_checkTimezone_();
  var todayISO = todayISO_();
  var classes = ev_classes_();
  var data = sheet_('sessions').getDataRange().getValues();
  var K = cols_('sessions', data[0]);
  ev_requireCols_('sessions', K, ['session_id', 'start_time'].concat(EV_CALS.map(function (c) { return c.col; })));

  var plan = ev_plan_(data, K, classes, todayISO);
  var cals = ev_openCalendars_();
  var out = [];
  EV_CALS.forEach(function (cal) {
    var n = plan.counts[cal.role];
    out.push('  ' + cal.label + ' (' + cals[cal.role].getName() + '): ' + n.want + ' sessions, ' +
             n.have + ' already have an event, ' + n.todo + ' to create');
  });
  plan.problems.forEach(function (p) { out.push('  SKIPPED ' + p); });

  if (!apply) {
    // One line per class, so every start time and length can be checked by eye before anything
    // is created. A time read from a Sheets time cell is where a drift would show.
    var seen = {};
    plan.tasks.forEach(function (t) {
      if (seen[t.c.key]) return; seen[t.c.key] = true;
      var r = ev_render_(t.cal.role, t.c, t);
      out.push('  First ' + r.title + ': ' + t.iso + ' ' + pad_(t.start.getHours()) + ':' + pad_(t.start.getMinutes()) +
               '-' + pad_(t.end.getHours()) + ':' + pad_(t.end.getMinutes()) + ' Pacific');
    });
    var prev = 'PREVIEW (nothing written) - ' + plan.tasks.length + ' event(s) to create\n' + out.join('\n') +
      '\nNothing written. Run createEventsApply() to create them.';
    Logger.log(prev); return prev;
  }

  var win = ev_window_(todayISO);
  var tagged = ev_tagged_(cals, win.from, win.to);
  var pending = [], made = 0, adopted = 0, lost = [], stopped = false;
  for (var i = 0; i < plan.tasks.length; i++) {
    if (ev_now_() - t0 > EV_BUDGET_MS) { stopped = true; break; }
    var t = plan.tasks[i], id;
    var already = (tagged[t.cal.role][t.sid] || [])[0];
    if (already) { id = already.getId(); adopted++; }
    else {
      var rr = ev_render_(t.cal.role, t.c, t);
      var ev = cals[t.cal.role].createEvent(rr.title, t.start, t.end, { description: rr.description });
      ev.setTag(EV_TAG, t.sid);
      id = ev.getId(); made++;
    }
    pending.push({ sid: t.sid, col: t.cal.col, id: id });
    if (pending.length >= EV_FLUSH_EVERY) { lost = lost.concat(ev_save_(pending)); pending = []; }
  }
  if (pending.length) lost = lost.concat(ev_save_(pending));

  var left = plan.tasks.length - made - adopted;
  var head = 'APPLY - ' + made + ' event(s) created, ' + adopted + ' adopted from an earlier run' +
             (stopped ? ', STOPPED at the time limit with ' + left + ' left' : '');
  lost.forEach(function (l) { out.push('  NOT SAVED ' + l); });
  var report = head + '\n' + out.join('\n') +
    (stopped ? '\nRun createEventsApply() again to carry on. Nothing is created twice.'
             : '\nDone. Run createEventsVerify() to check.');
  Logger.log(report); return report;
}

/**
 * Write a batch of event ids under the lock, against a fresh read, matched by session_id.
 * One setValues per calendar column touched. Returns lines for ids whose row has gone.
 */
function ev_save_(pending) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sheet = sheet_('sessions'), data = sheet.getDataRange().getValues();
    var K = cols_('sessions', data[0]), rowOf = {}, lost = [], touched = {};
    for (var i = 1; i < data.length; i++) {
      var ck = String(data[i][K.class_key] || '').trim();
      var sid = String(data[i][K.session_id] || '').trim() || (ck ? ck + '-' + fmtDate_(data[i][K.date_iso]) : '');
      if (sid) rowOf[sid] = i;
    }
    pending.forEach(function (p) {
      var r = rowOf[p.sid];
      if (r === undefined) { lost.push(p.sid + ' (' + p.col + ' ' + p.id + '): the session row is gone'); return; }
      if (String(data[r][K[p.col]] || '').trim()) return;       // someone else filled it: never overwrite
      data[r][K[p.col]] = p.id; touched[p.col] = true;
    });
    Object.keys(touched).forEach(function (col) {
      sheet.getRange(2, K[col] + 1, data.length - 1, 1)
        .setValues(data.slice(1).map(function (row) { return [row[K[col]]]; }));
    });
    SpreadsheetApp.flush();
    return lost;
  } finally { lock.releaseLock(); }
}

// ----------------------------- VERIFY -----------------------------

/**
 * Admin only. Every upcoming session that should have an event has one; every stored id is
 * really on its calendar at the right time; no session has two events; no calendar carries
 * a class it should not. One getEvents per calendar.
 */
function createEventsVerify() {
  assertAdmin_();
  _MEMO.tabs = {}; _MEMO.cols = {};
  ev_checkTimezone_();
  var todayISO = todayISO_(), classes = ev_classes_();
  var data = sheet_('sessions').getDataRange().getValues(), K = cols_('sessions', data[0]);
  var cals = ev_openCalendars_(), win = ev_window_(todayISO), tagged = ev_tagged_(cals, win.from, win.to);
  var plan = ev_plan_(data, K, classes, todayISO);
  var out = [], bad = 0;

  EV_CALS.forEach(function (cal) {
    var byId = {}, map = tagged[cal.role], missing = 0, gone = 0, wrongTime = 0, extra = {}, dups = 0;
    Object.keys(map).forEach(function (sid) {
      if (map[sid].length > 1) dups++;
      map[sid].forEach(function (e) { byId[e.getId()] = e; });
    });
    var wanted = {};
    for (var i = 1; i < data.length; i++) {
      var ck = String(data[i][K.class_key] || '').trim(), iso = ck ? fmtDate_(data[i][K.date_iso]) : '';
      if (!ck || !iso || iso < todayISO || !classes[ck] || !classes[ck].active) continue;
      if (String(data[i][K.state] || '').trim() === 'skipped') continue;
      var sid = String(data[i][K.session_id] || '').trim() || (ck + '-' + iso);
      var id = String(data[i][K[cal.col]] || '').trim();
      if (!ev_wants_(cal.role, classes[ck])) { if (id) extra[sid] = true; continue; }
      wanted[sid] = true;
      if (!id) { missing++; continue; }
      var e = byId[id];
      if (!e) { gone++; continue; }
      var tm = ev_time_(data[i][K.start_time]) || ev_time_(classes[ck].startTime), d = dateFromISO_(iso);
      var want = tm ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), tm.h, tm.m).getTime() : NaN;
      if (e.getStartTime().getTime() !== want) wrongTime++;
    }
    Object.keys(map).forEach(function (sid) { if (!wanted[sid]) extra[sid] = true; });
    extra = Object.keys(extra).length;
    var fails = missing + gone + wrongTime + extra + dups;
    if (fails) bad++;
    out.push((fails ? 'FAIL  ' : 'OK    ') + cal.label + ': ' + missing + ' missing, ' + gone +
             ' stored id not on the calendar, ' + wrongTime + ' at the wrong date or time, ' + dups +
             ' session(s) with two events, ' + extra + ' event(s) that should not be there');
  });
  plan.problems.forEach(function (p) { out.push('WARN  ' + p); });
  var report = out.join('\n') + '\n' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed');
  Logger.log(report); return report;
}
