
// ===== equivalence: v1 on old tabs  vs  v2 on new tabs =====
const ser = v => v === undefined ? 'undefined' : JSON.stringify(v, function (k, x) { return this[k] instanceof RealDate ? 'D:' + this[k].toISOString() : x; });
const V1 = fs.readFileSync('tests/fixtures/code.v1.gs', 'utf8');
const V2 = fs.readFileSync('code.gs', 'utf8');
const MIG = fs.readFileSync('migrate_scheduling.gs', 'utf8');
let fails = 0;
const check = (n, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) { fails++; if (x !== undefined) console.log('     ' + String(x).slice(0, 1500)); } };

function worlds(tabs) {
  const old = tabs || baseTabs();
  const m = makeEnv(MIG, old, E('admin'));
  m.ctx.migrationApply();
  m.ctx.cycleStartApply();
  const all = m.tabs;
  // v2 reads the classes tab for anything that writes, so the new world needs it.
  const newTabs = {}; ['topics','sessions','class_config','config','classes','class_teachers','reader_pairs']
    .forEach(t => newTabs[t] = all[t]);
  const oldTabs = {}; ['bible_basics_topics','world_history_topics','class_config','overrides'].forEach(t => oldTabs[t] = JSON.parse(JSON.stringify(old[t])));
  return { a: makeEnv(V1, oldTabs, ''), b: makeEnv(V2, newTabs, '') };
}

const STEPS = [
  ['admin','getPortalState',[]],
  ['shahad','getPortalState',[]],
  ['a','claimTopic',['bible-basics','BB-003','2026-10-06']],
  ['a','claimTopic',['bible-basics','BB-005','2026-09-22']],
  ['b','claimTopic',['bible-basics','BB-003','2026-10-13']],
  ['b','claimTopic',['bible-basics','BB-005','2026-10-20']],
  ['b','releaseTopic',['bible-basics','BB-005']],
  ['a','releaseTopic',['bible-basics','BB-005']],
  ['c','grabDate',['bible-basics','2026-10-06']],
  ['d','grabDate',['bible-basics','2026-10-06']],
  ['a','grabDate',['bible-basics','2026-10-06']],
  // World History grab/release on 2026-09-30 used to live here. It no longer belongs in an
  // equivalence test: v1 computed the schedule, so ANY future Wednesday was grabbable, while
  // v2 requires a generated slot (step 2a). In production that is the same 16-week window the
  // old WEEKS_AHEAD gave. The new rule is asserted in the endpoint suite instead - see
  // "a date with no slot cannot be grabbed" and the substitute tests there.

  ['admin','adminSetOverride',['world-history','2026-10-07',E('w'),'WH-027',false]],
  ['admin','adminSetOverride',['world-history','2026-10-14','','',true]],
  ['admin','adminClearOverride',['world-history','2026-10-07']],
  ['admin','adminReorder',['world-history','WH-027',99]],
  ['admin','adminAssignClaim',['bible-basics','BB-005','2026-11-03',E('b')]],
  ['admin','adminSetRotation',['bible-basics',2,E('c')]],
  ['admin','getAdminData',['bible-basics']],
  ['admin','getAdminData',['world-history']],
  ['','getPublicSchedule',['']],
  ['admin','getPortalState',[]],
];

// Equivalence runs on CLEAN data: every claim has a teaching date. A claim without one cannot
// become a session at all - see the dateless-claim check below, and cycleStartPreview, which
// reported MATCH on the live sheet, meaning no such rows exist there.
const cleanBase = baseTabs();
cleanBase.bible_basics_topics = cleanBase.bible_basics_topics.filter(r => r[0] !== 'BB-004');
const W = worlds(cleanBase);
const outs = { a: [], b: [] };
for (const [u, fn, args] of STEPS) {
  for (const side of ['a','b']) {
    const env = W[side];
    env.S.user = u ? E(u) : '';
    vm.runInContext('_MEMO = { tabs: {}, names: {}, cols: {} };', env.ctx);
    try { outs[side].push(ser(env.ctx[fn](...args))); } catch (e) { outs[side].push('THROW ' + e.message); }
  }
}
// v1 stored a snapshot of the claimant's name in the sheet; v2 stores only the email and resolves
// the name at display time (sheet-schema.md, History). So compare with that field removed, then
// check v2 resolved it correctly.
// v1 stored the claimant's name in the sheet; v2 resolves it at render. The name therefore
// differs wherever it appears - in the topic list AND inside refusal messages.
const strip = s => s
  .replace(/"claimedByName":"[^"]*"/g, '"claimedByName":"~"')
  .replace(/taken by [^.]+\./g, 'taken by ~.')
  .replace(/covered by [^.]+\./g, 'covered by ~.')
  .replace(/claimed by [^.]+\./g, 'claimed by ~.')
  .replace(/Only [^.]+ or an admin/g, 'Only ~ or an admin');
const diffs = outs.a.map((o, i) => strip(o) === strip(outs.b[i]) ? null : i).filter(x => x !== null);
{
  const st = JSON.parse(outs.b[outs.b.length - 1]);
  const claimed = st.classes.find(c => c.key === 'bible-basics').topics.filter(t => t.status === 'Claimed');
  check('v2 resolves the claimant name from the directory, not the sheet',
    claimed.length > 0 && claimed.every(t => t.claimedByName === 'N ' + t.claimedByEmail.split('@')[0]),
    JSON.stringify(claimed.slice(0, 2)));
}
check(`all ${STEPS.length} steps return identical state (old tabs vs new tabs)`, diffs.length === 0,
  diffs.map(i => `step ${i} ${JSON.stringify(STEPS[i])}\n  v1: ${outs.a[i].slice(0,700)}\n  v2: ${outs.b[i].slice(0,700)}`).join('\n'));
const okCount = outs.a.filter(o => o.includes('"ok":true')).length, noCount = outs.a.filter(o => o.includes('"ok":false')).length;
check(`scenario covers both paths (${okCount} succeeded, ${noCount} refused)`, okCount >= 8 && noCount >= 3,   // three world-history steps moved to the endpoint suite

  outs.a.map((o,i)=>i+' '+o.slice(0,70)).join('\n'));

// moving a claim to another date: v1 leaves the substitute teacher stranded on the emptied date
// (its own releaseTopic calls that a thing to avoid); v2 clears the date completely.
{
  const w = worlds(cleanBase);
  const res = {};
  for (const side of ['a','b']) {
    const env = w[side]; env.S.user = E('admin');
    vm.runInContext('_MEMO={tabs:{},names:{},cols:{}};', env.ctx);
    const r = env.ctx.adminAssignClaim('bible-basics', 'BB-001', '2026-11-10', E('b'));
    check(side + ': the move itself succeeds', r.ok === true, JSON.stringify(r).slice(0, 200));
    vm.runInContext('_MEMO={tabs:{},names:{},cols:{}};', env.ctx);
    const st = env.ctx.getPortalState().classes.find(c => c.key === 'bible-basics');
    res[side] = {
      vacated: st.schedule.find(x => x.iso === '2026-09-22'),
      moved: st.schedule.find(x => x.iso === '2026-11-10'),
    };
  }
  check('both land the claim on the new date',
    res.a.moved.topicId === 'BB-001' && res.b.moved.topicId === 'BB-001',
    JSON.stringify([res.a.moved, res.b.moved]));
  check('known improvement: v1 strands a substitute on the vacated date, v2 leaves it clean',
    res.a.vacated.teacherEmail === E('mathathyah') && res.b.vacated.teacherEmail === '',
    JSON.stringify([res.a.vacated, res.b.vacated]));
}

// a claim with no teaching date: v1 calls it Claimed from its status column, v2 calls it Open
// because nothing dates it. The migration warns about exactly these rows.
{
  const w = worlds();                                  // the messy base, BB-004 has no date
  const t1 = (u => { w.a.S.user = E('admin'); vm.runInContext('_MEMO={tabs:{},names:{},cols:{}};', w.a.ctx);
    return w.a.ctx.getPortalState().classes[0].topics.find(t => t.id === 'BB-004'); })();
  const t2 = (u => { w.b.S.user = E('admin'); vm.runInContext('_MEMO={tabs:{},names:{},cols:{}};', w.b.ctx);
    return w.b.ctx.getPortalState().classes[0].topics.find(t => t.id === 'BB-004'); })();
  check('known divergence: a dateless claim is Claimed in v1, Open in v2',
    t1.status === 'Claimed' && t2.status === 'Open', JSON.stringify([t1, t2]));
}

// v2-only behaviour: the cycle reset moves the date instead of erasing
{
  const w = worlds(); const env = w.b; env.S.user = E('admin');
  const sess = env.tabs.sessions, h = sess[0].map(x => String(x).trim().toLowerCase());
  const ix = n => h.indexOf(n);
  // make every BB topic taught in the past
  env.ctx.setCfg_('cycle_started_on.bible-basics', '2026-08-01');   // sessions below sit inside this cycle
  const topics = recs(env.tabs,'topics').filter(r => r.class_key === 'bible-basics');
  env.tabs.sessions = [sess[0]];
  topics.forEach((t, i) => { const row = new Array(h.length).fill('');
    row[ix('session_id')] = 'bible-basics-2026-08-' + String(10 + i).padStart(2,'0');
    row[ix('class_key')] = 'bible-basics'; row[ix('date_iso')] = '2026-08-' + String(10 + i).padStart(2,'0');
    row[ix('topic_id')] = t.topic_id; row[ix('owner_email')] = E('a'); row[ix('teacher_email')] = E('a');
    row[ix('state')] = 'scheduled'; env.tabs.sessions.push(row); });
  vm.runInContext('_MEMO = { tabs: {}, names: {}, cols: {} };', env.ctx);
  const beforeSessions = env.tabs.sessions.length;
  env.ctx.reopenCompletedCycle();
  const cfg = recs(env.tabs,'config').find(r => r.key === 'cycle_started_on.bible-basics');
  check('cycle reset moves the start date forward', cfg.value === '2026-09-19', JSON.stringify(cfg));
  check('cycle reset erases nothing', env.tabs.sessions.length === beforeSessions);
  vm.runInContext('_MEMO = { tabs: {}, names: {}, cols: {} };', env.ctx);
  const st = env.ctx.getPortalState().classes.find(c => c.key === 'bible-basics');
  check('after reset every topic is Open again', st.counts.open === st.counts.total && st.counts.claimed === 0, JSON.stringify(st.counts));
}
// a sessions tab created by the earlier migration has no owner_email: upgrade must add and backfill it
{
  const old = baseTabs();
  const m = makeEnv(MIG, old, E('admin'));
  m.ctx.migrationApply();
  const h = m.tabs.sessions[0], oi = h.indexOf('owner_email');
  m.tabs.sessions.forEach(r => r.splice(oi, 1));           // pretend the column was never there
  check('simulated old tab really lacks owner_email', !m.tabs.sessions[0].includes('owner_email'));
  const p = m.ctx.upgradeHeadersPreview();
  check('upgrade preview writes nothing', !m.tabs.sessions[0].includes('owner_email'), p);
  check('upgrade preview names the column and the backfill', /add owner_email/.test(p) && /backfill owner_email on [1-9]/.test(p), p);
  const a = m.ctx.upgradeHeadersApply();
  const rows = recs(m.tabs, 'sessions');
  const claims = rows.filter(r => r.class_key === 'bible-basics');
  check('upgrade adds the column and backfills claim rows', claims.length > 0 && claims.every(r => r.owner_email === r.teacher_email), JSON.stringify(claims[0]));
  check('non-claim rows left alone', rows.filter(r => r.class_key !== 'bible-basics').every(r => !r.owner_email));
  const again = m.ctx.upgradeHeadersApply();
  check('upgrade is idempotent', /nothing to do/.test(again), again);
}

// retiring the old tabs: renames, keeps every row, never touches class_config, idempotent
{
  const old = baseTabs();
  const m = makeEnv(MIG, old, E('admin'));
  m.ctx.migrationApply();
  const rowsBefore = old.bible_basics_topics.length;
  const p = m.ctx.retireOldTabsPreview();
  check('retire preview renames nothing', !!m.tabs.bible_basics_topics && !m.tabs.zz_old_bible_basics_topics, p);
  check('retire preview keeps class_config', /class_config: KEPT/.test(p), p);
  m.ctx.retireOldTabsApply();
  check('old tabs renamed with every row kept',
    !m.tabs.bible_basics_topics && m.tabs.zz_old_bible_basics_topics.length === rowsBefore &&
    !!m.tabs.zz_old_world_history_topics && !!m.tabs.zz_old_overrides, Object.keys(m.tabs).join(','));
  check('class_config untouched', !!m.tabs.class_config && !m.tabs.zz_old_class_config);
  check('retire is idempotent', /0 tab\(s\)/.test(m.ctx.retireOldTabsApply()));
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
