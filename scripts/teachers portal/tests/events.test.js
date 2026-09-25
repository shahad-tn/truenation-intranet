// ===== step 2b: empty calendar events =====
const V2 = fs.readFileSync('code.gs', 'utf8');
const GEN = fs.readFileSync('generate_slots.gs', 'utf8');
const EV = fs.readFileSync('create_events.gs', 'utf8');
const MIG = fs.readFileSync('migrate_scheduling.gs', 'utf8');
let fails = 0;
const check = (n, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) { fails++; if (x !== undefined) console.log('     ' + String(x).slice(0, 1500)); } };
const TODAY = '2026-09-19';
const isoOf = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const hm = d => String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
const IDS = {
  cal_id_teachers: 'c_9b209f6c75a63b3a2311e226d3de7024544530431629089617b2cfba8823fe72@group.calendar.google.com',
  cal_id_readers:  'c_30f8f2961f68629061c5152bbb1982a8d1e1c735c0c376592a52872b417a8a87@group.calendar.google.com',
  cal_id_graphics: 'c_fdd7b951d94adf843ba87f81f9da54613ca4e2e260a126efaf3c9dae7c6afe2b@group.calendar.google.com',
  cal_id_public:   'c_85c7267c2722d696fbf37ffba64d4c5f40156e85002a88affa960ba56f71018a@group.calendar.google.com'
};
const ROLE_OF = { [IDS.cal_id_teachers]: 'teachers', [IDS.cal_id_readers]: 'readers', [IDS.cal_id_graphics]: 'graphics', [IDS.cal_id_public]: 'public' };

// A fake CalendarApp. Every call that would be a round trip to Google is counted.
function fakeCalendar(opts = {}) {
  const cals = {}, calls = { count: 0, detail: [] }, hooks = { onCreate: null };
  let n = 0;
  const hit = what => { calls.count++; calls.detail.push(what); };
  Object.keys(ROLE_OF).forEach(id => {
    const events = [];
    cals[id] = { events,
      getName: () => 'Fake ' + ROLE_OF[id],
      createEvent: (title, start, end, o) => {
        hit('createEvent ' + ROLE_OF[id]);
        if (hooks.onCreate) hooks.onCreate(n + 1);
        const ev = { _id: 'ev' + (++n) + '@google.com', title, start, end, desc: (o || {}).description, tags: {} };
        const api = { getId: () => ev._id, getTitle: () => ev.title, getStartTime: () => ev.start, getEndTime: () => ev.end,
          getDescription: () => ev.desc, getTag: k => ev.tags[k] || null,
          setTag: (k, v) => { hit('setTag'); ev.tags[k] = v; return api; }, _raw: ev };
        events.push(api); return api;
      },
      getEvents: (from, to) => { hit('getEvents ' + ROLE_OF[id]); return events.filter(e => e._raw.start >= from && e._raw.start < to); },
    };
  });
  const app = { getCalendarById: id => { hit('getCalendarById'); return (opts.noAccess || []).includes(ROLE_OF[id]) ? null : (cals[id] || null); } };
  return { app, cals, calls, hooks, byRole: r => cals[Object.keys(ROLE_OF).find(id => ROLE_OF[id] === r)].events };
}

// A migrated sheet with every slot generated, as it stands live today.
function world(user = E('admin'), mut) {
  const m = makeEnv(MIG, baseTabs(), E('admin'));
  m.ctx.migrationApply(); m.ctx.upgradeHeadersApply(); m.ctx.cycleStartApply();
  const g = makeEnv(V2 + '\n' + GEN, m.tabs, E('admin'));
  g.ctx.generateSlotsApply();
  if (mut) mut(g.tabs);
  const env = makeEnv(V2 + '\n' + GEN + '\n' + EV, g.tabs, user);
  const cal = fakeCalendar(mut && mut.calOpts);
  env.ctx.CalendarApp = cal.app;
  env.ctx.Session.getScriptTimeZone = () => env.tz || 'America/Los_Angeles';
  const open = env.ctx.SpreadsheetApp.openById;
  env.ctx.SpreadsheetApp.openById = id => Object.assign(open(id), { getSpreadsheetTimeZone: () => env.sheetTz || 'America/Los_Angeles' });
  env.cal = cal;
  env.reset = () => vm.runInContext('_MEMO = { tabs: {}, names: {}, cols: {} };', env.ctx);
  env.counters = () => { env.reads.count = 0; env.writes.count = 0; env.reads.detail.length = 0; env.writes.detail.length = 0; cal.calls.count = 0; cal.calls.detail.length = 0; };
  return env;
}
const withIds = env => { env.reset(); env.ctx.setCalendarIds(); env.reset(); };
const cfgVal = (tabs, k) => (recs(tabs, 'config').find(r => r.key === k) || {}).value;
const tally = arr => { const o = {}; arr.forEach(x => o[x] = (o[x] || 0) + 1); return o; };

// What SHOULD be on each calendar, worked out here from the rules, not from the code.
function expected(tabs) {
  const cls = {}; recs(tabs, 'classes').forEach(c => cls[c.class_key] = c);
  const out = { teachers: [], readers: [], graphics: [], public: [] };
  recs(tabs, 'sessions').forEach(s => {
    const iso = s.date_iso instanceof RealDate ? isoOf(s.date_iso) : String(s.date_iso);
    if (!s.class_key || iso < TODAY || s.state === 'skipped') return;
    const c = cls[s.class_key]; if (!c) return;
    out.teachers.push(s.session_id); out.public.push(s.session_id);
    if (c.reader_mode !== 'none') out.readers.push(s.session_id);
    if (s.class_key !== 'qa-on-the-spot-a-team') out.graphics.push(s.session_id);
  });
  return out;
}

// ---------------------------------------------------------------- setCalendarIds
{
  const env = world();
  env.reset(); const r1 = env.ctx.setCalendarIds();
  check('setCalendarIds writes all four ids into config',
    Object.keys(IDS).every(k => cfgVal(env.tabs, k) === IDS[k]), r1);
  env.reset(); env.counters(); const r2 = env.ctx.setCalendarIds();
  check('setCalendarIds a second time writes nothing', env.writes.count === 0 && /already set/.test(r2), r2);
  const moreh = world(E('shahad'));
  let threw = ''; try { moreh.reset(); moreh.ctx.setCalendarIds(); } catch (e) { threw = e.message; }
  check('setCalendarIds is admin only', /Admin access required/.test(threw), threw);
}

// ---------------------------------------------------------------- preview / apply / verify
const env = world(E('admin'), tabs => {
  // one skipped session and one class time stored as a Sheets time value, as the live sheet may hold it
  const h = tabs.sessions[0], st = h.indexOf('state'), ck = h.indexOf('class_key'), di = h.indexOf('date_iso');
  const row = tabs.sessions.find(r => r[ck] === 'room-144' && String(r[di]) === '2026-10-02');
  row[st] = 'skipped';
  const ch = tabs.classes[0], t = ch.indexOf('start_time');
  tabs.classes.find(r => r[0] === 'war-for-the-kingdom')[t] = new RealDate(1899, 11, 30, 14, 0);
});
withIds(env);
const want = expected(env.tabs);
check('the fixture has sessions on every calendar', Object.values(want).every(a => a.length > 20),
  JSON.stringify(Object.fromEntries(Object.entries(want).map(([k, v]) => [k, v.length]))));

env.reset(); env.counters();
const before = JSON.stringify(env.tabs.sessions);
const prev = env.ctx.createEventsPreview();
check('preview writes nothing to the sheet', JSON.stringify(env.tabs.sessions) === before && env.writes.count === 0);
check('preview creates no events', !env.cal.calls.detail.some(c => /createEvent|setTag/.test(c)), env.cal.calls.detail.join(','));
const total = Object.values(want).reduce((a, b) => a + b.length, 0);
check(`preview counts ${total} events to create`, prev.includes(total + ' event(s) to create'), prev);
console.log(prev.split('\n').map(l => '     ' + l).join('\n'));

env.reset(); env.counters();
const app = env.ctx.createEventsApply();
const applyCal = env.cal.calls.count, applyWrites = env.writes.count, applyReads = env.reads.count;
const calTally = tally(env.cal.calls.detail.map(d => d.split(' ')[0]));
check('apply reports every event created', app.startsWith('APPLY - ' + total + ' event(s) created, 0 adopted'), app);

const S = recs(env.tabs, 'sessions');
const bySid = {}; S.forEach(s => bySid[s.session_id] = s);
['teachers', 'readers', 'graphics', 'public'].forEach(role => {
  const evs = env.cal.byRole(role);
  const tags = evs.map(e => e.getTag('tn_session_id')).sort();
  check(`${role}: exactly the sessions the rules give (${want[role].length})`,
    JSON.stringify(tags) === JSON.stringify(want[role].slice().sort()),
    'extra ' + tags.filter(t => !want[role].includes(t)).slice(0, 5) + ' missing ' + want[role].filter(t => !tags.includes(t)).slice(0, 5));
  check(`${role}: every event's id is stored on its own session row`,
    evs.every(e => bySid[e.getTag('tn_session_id')]['cal_event_' + role] === e.getId()));
});
check('readers calendar has no Q&A and no Feed The Sheep',
  !env.cal.byRole('readers').some(e => /^(qa-on-the-spot|feed-the-sheep)/.test(e.getTag('tn_session_id'))));
check('graphics calendar has Feed The Sheep but no Q&A',
  env.cal.byRole('graphics').some(e => /^feed-the-sheep/.test(e.getTag('tn_session_id'))) &&
  !env.cal.byRole('graphics').some(e => /^qa-on-the-spot/.test(e.getTag('tn_session_id'))));
check('a skipped session gets no event on any calendar',
  !['teachers','readers','graphics','public'].some(r => env.cal.byRole(r).some(e => e.getTag('tn_session_id') === 'room-144-2026-10-02')));
check('no event for a session before today',
  env.cal.byRole('teachers').every(e => isoOf(e.getStartTime()) >= TODAY));

const ev1 = env.cal.byRole('teachers').find(e => e.getTag('tn_session_id') === 'bible-basics-2026-09-22');
check('Bible Basics: title is the class name alone, 19:30-21:00 Pacific',
  ev1 && ev1.getTitle() === 'Bible Basics' && hm(ev1.getStartTime()) === '19:30' && hm(ev1.getEndTime()) === '21:00',
  ev1 && [ev1.getTitle(), ev1.getStartTime(), ev1.getEndTime()].join(' | '));
check('staff event links to its session page',
  ev1 && ev1.getDescription().includes('https://portal.truenation.org/portal/classes/bible-basics/2026-09-22'), ev1 && ev1.getDescription());
const pub = env.cal.byRole('public').find(e => e.getTag('tn_session_id') === 'bible-basics-2026-09-22');
check('public event carries no link and no description', pub && pub.getDescription() === '', pub && pub.getDescription());
const war = env.cal.byRole('teachers').find(e => /^war-for-the-kingdom/.test(e.getTag('tn_session_id')));
check('War for The Kingdom: a Sheets time value is read, and it runs two hours (14:00-16:00)',
  war && hm(war.getStartTime()) === '14:00' && hm(war.getEndTime()) === '16:00', war && hm(war.getStartTime()) + '-' + hm(war.getEndTime()));
const blue = env.cal.byRole('teachers').find(e => /^blue-strip/.test(e.getTag('tn_session_id')));
check('Blue Strip at 17:30', blue && hm(blue.getStartTime()) === '17:30');

// Round trips. Each is a call to Google; a per-cell version of generate once took three minutes.
const flushes = Math.ceil(total / 20);
check(`apply calendar calls: ${applyCal} = one create + one tag per event, plus 4 opens and 4 lookups`,
  applyCal === total * 2 + 8, JSON.stringify(calTally));
check(`apply sheet writes: ${applyWrites} for ${total} ids (at most 4 columns per batch of 20)`,
  applyWrites <= flushes * 4, env.writes.detail.slice(0, 10).join('\n'));
check(`apply sheet reads: ${applyReads}, not one per event`, applyReads <= flushes + 20, JSON.stringify(tally(env.reads.detail)));

env.reset(); env.counters();
const again = env.ctx.createEventsApply();
check('a second apply creates nothing', again.startsWith('APPLY - 0 event(s) created, 0 adopted') &&
  !env.cal.calls.detail.some(c => /createEvent/.test(c)), again.split('\n')[0]);

env.reset();
const ver = env.ctx.createEventsVerify();
check('verify passes after apply', ver.includes('all checks passed'), ver);

// verify has teeth
{
  const tEvents = env.cal.byRole('teachers'); const gone = tEvents.splice(3, 1)[0];
  env.reset(); const v = env.ctx.createEventsVerify();
  check('verify catches an event deleted from the calendar', /FAIL  Teachers: 0 missing, 1 stored id not on the calendar/.test(v), v);
  tEvents.splice(3, 0, gone);
  gone._raw.start = new RealDate(gone._raw.start.getTime() + 3600000);
  env.reset(); const v2 = env.ctx.createEventsVerify();
  check('verify catches an event moved to the wrong time', /Teachers: .* 1 at the wrong date or time/.test(v2), v2);
  gone._raw.start = new RealDate(gone._raw.start.getTime() - 3600000);
  const dupe = env.cal.cals[IDS.cal_id_public].createEvent('X', gone._raw.start, gone._raw.end, {});
  dupe.setTag('tn_session_id', gone.getTag('tn_session_id'));
  env.reset(); const v3 = env.ctx.createEventsVerify();
  check('verify catches a session with two events', /FAIL  Public Classes: .* 1 session\(s\) with two events/.test(v3), v3);
}

// ---------------------------------------------------------------- resumable
{
  const e2 = world(); withIds(e2);
  let clock = new RealDate(2026, 8, 19, 12).getTime();
  vm.runInContext('ev_now_ = function () { return __clock(); };', Object.assign(e2.ctx, { __clock: () => clock }));
  e2.cal.hooks.onCreate = () => { clock += 1000; };        // each event takes a second
  vm.runInContext('EV_BUDGET_MS = 60000;', e2.ctx);           // one minute per run, for the test
  const w2 = expected(e2.tabs), tot = Object.values(w2).reduce((a, b) => a + b.length, 0);
  e2.reset(); const r1 = e2.ctx.createEventsApply();
  check('a run that hits its time limit stops and says how many are left', /STOPPED at the time limit with \d+ left/.test(r1), r1.split('\n')[0]);
  let runs = 1, last = r1;
  while (/STOPPED/.test(last) && runs < 50) { clock += 1; e2.reset(); last = e2.ctx.createEventsApply(); runs++; }
  const all = ['teachers','readers','graphics','public'].reduce((a, r) => a + e2.cal.byRole(r).length, 0);
  check(`re-running finishes the job in ${runs} runs with no duplicates (${all} events)`, all === tot, all + ' vs ' + tot);
  e2.reset(); check('verify passes after a resumed run', e2.ctx.createEventsVerify().includes('all checks passed'));
}

// ---------------------------------------------------------------- a run that dies mid-way
{
  const e3 = world(); withIds(e3);
  e3.cal.hooks.onCreate = k => { if (k === 30) throw new Error('Service invoked too many times'); };
  e3.reset(); let threw = ''; try { e3.ctx.createEventsApply(); } catch (e) { threw = e.message; }
  const stored = recs(e3.tabs, 'sessions').filter(s => s.cal_event_teachers || s.cal_event_readers || s.cal_event_graphics || s.cal_event_public).length;
  check('a crash at event 30 leaves the first 20 ids saved', threw && stored > 0, threw + ' stored rows ' + stored);
  e3.cal.hooks.onCreate = null;
  e3.reset(); const r = e3.ctx.createEventsApply();
  check('the next run adopts the 9 orphaned events instead of duplicating them', /created, 9 adopted/.test(r), r.split('\n')[0]);
  e3.reset(); check('and verify passes', e3.ctx.createEventsVerify().includes('all checks passed'));
}

// ---------------------------------------------------------------- rows moving under a run
{
  const e4 = world(); withIds(e4);
  let victim = '';
  e4.cal.hooks.onCreate = k => {
    // Between two saves the portal deletes a row: the one whose event was just made and is
    // not saved yet (event 24 of a batch of 21-40). Every row below it moves up by one.
    if (k !== 25) return;
    const made = ['teachers','readers','graphics','public'].flatMap(r => e4.cal.byRole(r));
    const lastSid = made.find(e => e.getId() === 'ev24@google.com').getTag('tn_session_id');
    const h = e4.tabs.sessions[0], si = h.indexOf('session_id');
    const idx = e4.tabs.sessions.findIndex((r, i) => i > 0 && r[si] === lastSid);
    victim = lastSid; e4.tabs.sessions.splice(idx, 1);
  };
  e4.reset(); const r = e4.ctx.createEventsApply();
  const S4 = recs(e4.tabs, 'sessions'); let ok = true, bad = [];
  ['teachers','readers','graphics','public'].forEach(role => e4.cal.byRole(role).forEach(ev => {
    const s = S4.find(x => x.session_id === ev.getTag('tn_session_id'));
    if (s && s['cal_event_' + role] !== ev.getId()) { ok = false; bad.push(role + ' ' + s.session_id); }
  }));
  check('a row deleted mid-run does not shift ids onto the wrong sessions', ok, bad.slice(0, 5).join(', '));
  check('an id whose row has gone is reported, not written elsewhere', r.includes('NOT SAVED ' + victim), r);
}

// ---------------------------------------------------------------- refusals
{
  const e5 = world();
  let t = ''; try { e5.reset(); e5.ctx.createEventsPreview(); } catch (e) { t = e.message; }
  check('no calendar ids in config: stops and says run setCalendarIds()', /Run setCalendarIds\(\) first/.test(t), t);

  const opts = { noAccess: ['public'] }, mut = () => {}; mut.calOpts = opts;
  const e6 = world(E('admin'), mut); withIds(e6);
  t = ''; try { e6.ctx.createEventsApply(); } catch (e) { t = e.message; }
  check('a calendar the account cannot open: stops before creating anything',
    /Cannot open the Public Classes calendar/.test(t) && !e6.cal.calls.detail.some(c => /createEvent/.test(c)), t);

  const e7 = world(); withIds(e7); e7.sheetTz = 'America/New_York';
  t = ''; try { e7.ctx.createEventsApply(); } catch (e) { t = e.message; }
  check('a spreadsheet not on Pacific time: stops before creating anything',
    /Timezone mismatch/.test(t) && !e7.cal.calls.detail.some(c => /createEvent/.test(c)), t);

  const e8 = world(E('shahad')); 
  t = ''; try { e8.reset(); e8.ctx.createEventsApply(); } catch (e) { t = e.message; }
  check('a moreh member who is not an admin cannot run it', /Admin access required/.test(t), t);
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
