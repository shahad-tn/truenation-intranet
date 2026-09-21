
// ===== step 2a: slot generation =====
const ser = v => v === undefined ? 'undefined' : JSON.stringify(v, function (k, x) { return this[k] instanceof RealDate ? 'D:' + this[k].toISOString() : x; });
const V2 = fs.readFileSync('code.gs', 'utf8');
const GEN = fs.readFileSync('generate_slots.gs', 'utf8');
const MIG = fs.readFileSync('migrate_scheduling.gs', 'utf8');
let fails = 0;
const check = (n, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) { fails++; if (x !== undefined) console.log('     ' + String(x).slice(0, 1200)); } };

// independent cadence maths, written from the rules not the code
const WD = ['sun','mon','tue','wed','thu','fri','sat'];
function expectDates(weekday, weeks, horizonWeeks) {
  const out = [], d = new RealDate(2026, 8, 19), end = new RealDate(2026, 8, 19);
  end.setDate(end.getDate() + horizonWeeks * 7);
  while (d <= end) {
    if (d.getDay() === weekday && weeks.includes(Math.ceil(d.getDate() / 7)))
      out.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const base = baseTabs();
const m = makeEnv(MIG, base, E('admin'));
m.ctx.migrationApply(); m.ctx.upgradeHeadersApply(); m.ctx.cycleStartApply();
const env = makeEnv(V2 + '\n' + GEN, m.tabs, E('admin'));
const tabs = env.tabs;                       // makeEnv copies, so read the env's own sheets
const reset = () => vm.runInContext('_MEMO = { tabs: {}, names: {}, cols: {} };', env.ctx);

// what the portal shows for World History BEFORE any slots exist
reset();
const whBefore = env.ctx.getPortalState().classes.find(c => c.key === 'world-history').schedule
  .map(r => r.iso + '|' + r.topicName + '|' + r.teacherEmail);
const bbClaimsBefore = recs(tabs,'sessions').filter(r => r.class_key === 'bible-basics')
  .map(r => r.date_iso + '|' + r.topic_id + '|' + r.teacher_email).sort();

reset();
const before = JSON.stringify(tabs.sessions);
const prev = env.ctx.generateSlotsPreview();
check('preview writes nothing', JSON.stringify(tabs.sessions) === before);
console.log(prev.split('\n').map(l => '     ' + l).join('\n'));

reset();
env.writes.count = 0; env.writes.detail.length = 0;
env.reads.count = 0; env.reads.detail.length = 0;
env.ctx.generateSlotsApply();
const applyWrites = env.writes.count, applyDetail = env.writes.detail.slice();
const applyReads = env.reads.count, readDetail = env.reads.detail.slice();
const S = recs(tabs,'sessions');
// Each write here is one round trip to Google. A cell-at-a-time seq_no fill made ~140 of them
// and took three minutes against the live sheet before Shahad cancelled it (2026-09-19).
check(`apply is batched: ${applyWrites} write call(s) for 128 rows, not one per cell`,
  applyWrites <= 12, applyDetail.join('\n'));
// Reads are round trips too. The first live run spent three minutes on ~128 getLastColumn calls
// while building rows, before writing anything at all.
const readCounts = {};
readDetail.forEach(r => readCounts[r] = (readCounts[r] || 0) + 1);
check(`apply reads the sheet ${applyReads} time(s), not once per row`, applyReads <= 40,
  JSON.stringify(readCounts));
const byClass = {};
S.forEach(r => (byClass[r.class_key] || (byClass[r.class_key] = [])).push(r));
Object.keys(byClass).forEach(k => byClass[k].sort((a,b) => a.date_iso < b.date_iso ? -1 : 1));

// 1. counts match the independent cadence maths
const cls = recs(tabs,'classes');
let countsOk = true, detail = [];
cls.forEach(c => {
  const want = expectDates(Number(c.weekday), String(c.weeks).split(',').map(Number), 16);
  const got = (byClass[c.class_key] || []).filter(r => r.date_iso >= '2026-09-19').map(r => r.date_iso);
  const same = want.length === got.length && want.every(d => got.includes(d));
  if (!same) { countsOk = false; detail.push(`${c.class_key}: want ${want.length} got ${got.length}`); }
});
check('every class has exactly the dates the cadence rules give', countsOk, detail.join('\n'));
check('no 5th-Thursday for a 2nd-and-4th class',
  !(byClass['stick-to-the-script']||[]).some(r => Math.ceil(Number(r.date_iso.slice(8)) / 7) === 5),
  (byClass['stick-to-the-script']||[]).map(r=>r.date_iso).join(','));
check('a weekly Friday class does keep its 5th Friday',
  (byClass['blue-strip']||[]).some(r => Math.ceil(Number(r.date_iso.slice(8)) / 7) === 5));

// 2. rotation anchors land where Shahad said
const firstUpcoming = k => (byClass[k]||[]).filter(r => r.date_iso >= '2026-09-19')[0];
check('Stick to the Script starts with Banayah', firstUpcoming('stick-to-the-script').teacher_email === E('banayah'), firstUpcoming('stick-to-the-script').teacher_email);
check('Room 144 starts with Izar Ahla', firstUpcoming('room-144').teacher_email === E('izarahla'), firstUpcoming('room-144').teacher_email);
check('Los Discipulos starts with Ash', firstUpcoming('los-discipulos').teacher_email === E('ash'), firstUpcoming('los-discipulos').teacher_email);
check('World History is Ahman Ahla throughout',
  (byClass['world-history']||[]).filter(r=>r.date_iso>='2026-09-19').every(r => r.teacher_email === E('ahmanahla')));

// 3. the rotation walks in order, one step per session
// 2026-10-02 came over from the overrides tab already cancelled, with no teacher: generation
// does not touch existing rows, so it is excluded from the rotation walk.
const skipped = (byClass['room-144']||[]).filter(r => r.state === 'skipped').map(r => r.date_iso);
check('the migrated Feast-day row is still skipped and untouched', skipped.length === 1 && skipped[0] === '2026-10-02', skipped.join(','));
const r144 = (byClass['room-144']||[]).filter(r => r.date_iso >= '2026-09-19' && r.state !== 'skipped').map(r => r.teacher_email.split('@')[0]);
// Decision C in the wild: 2026-10-02 was Ash's turn and is a skipped Feast day. He loses that
// round; every later date keeps the teacher it already had. That is why 'ash' is absent between
// izarahla and banayah at the start, and appears again one cycle later.
check('rotation walks in order, and the skipped date costs only that teacher his turn',
  r144.slice(0,6).join(',') === 'izarahla,banayah,izarahla,ash,banayah,izarahla', r144.slice(0,6).join(','));
const sts = (byClass['stick-to-the-script']||[]).filter(r => r.date_iso >= '2026-09-19').map(r => r.teacher_email.split('@')[0]);
check('Stick to the Script walks its four teachers',
  sts.slice(0,5).join(',') === 'banayah,shahad,raiyah,mathathyah,banayah', sts.slice(0,5).join(','));

// 4. readers
check('fixed reader on Blue Strip', (byClass['blue-strip']||[]).every(r => r.reader_email === E('izarahla') && r.reader_source === 'fixed'));
check('paired reader follows the teacher on Room 144',
  (byClass['room-144']||[]).filter(r=>r.date_iso>='2026-09-19' && r.state !== 'skipped').slice(0,3)
    .every(r => (r.teacher_email === E('izarahla') && r.reader_email === E('shahad')) ||
                (r.teacher_email === E('ash') && r.reader_email === E('ahmanahla')) ||
                (r.teacher_email === E('banayah') && r.reader_email === E('mathathyah'))),
  (byClass['room-144']||[]).slice(0,3).map(r=>r.teacher_email+'->'+r.reader_email).join(' '));
check('panel class has no teacher and no reader',
  (byClass['qa-on-the-spot-a-team']||[]).every(r => !r.teacher_email && !r.reader_email),
  JSON.stringify((byClass['qa-on-the-spot-a-team']||[])[0]));
check('Los Discipulos readers are the other teacher',
  (byClass['los-discipulos']||[]).filter(r=>r.date_iso>='2026-09-19').every(r =>
    (r.teacher_email === E('ash') && r.reader_email === E('malaakaya')) ||
    (r.teacher_email === E('malaakaya') && r.reader_email === E('ash'))));

// 5. nothing existing was disturbed
const bbClaimsAfter = S.filter(r => r.class_key === 'bible-basics' && r.topic_id)
  .map(r => r.date_iso + '|' + r.topic_id + '|' + r.teacher_email).sort();
check('migrated Bible Basics claims untouched', JSON.stringify(bbClaimsAfter) === JSON.stringify(bbClaimsBefore),
  JSON.stringify([bbClaimsBefore, bbClaimsAfter]));
check('new Bible Basics slots are empty, waiting to be claimed',
  (byClass['bible-basics']||[]).filter(r => r.date_iso >= '2026-09-22' && !r.topic_id).every(r => !r.teacher_email && !r.owner_email));

// 6. World History topics unchanged from what teachers already see
reset();
const whAfter = env.ctx.getPortalState().classes.find(c => c.key === 'world-history').schedule
  .map(r => r.iso + '|' + r.topicName + '|' + r.teacherEmail);
const topics = a => a.map(x => x.split('|')[0] + '|' + x.split('|')[1]);
check('World History topics are unchanged by generation - teachers see the same sequence',
  JSON.stringify(topics(whAfter)) === JSON.stringify(topics(whBefore)),
  JSON.stringify([whBefore.slice(0,3), whAfter.slice(0,3)]));
// The teacher is the deliberate change: it used to come from class_config's week-of-month table,
// which left dates blank when that week had no entry. It now comes from class_teachers.
const blanksBefore = whBefore.filter(x => x.split('|')[2] === '').length;
check('generation fills the teacher gaps the old week-of-month table left',
  blanksBefore > 0 && whAfter.every(x => x.split('|')[2] === E('ahmanahla')),
  'blank before: ' + blanksBefore + ', after: ' + whAfter.filter(x => x.split('|')[2] === '').length);

// 7. seq_no, anchors, idempotency, verify
const seqOk = Object.keys(byClass).every(k => byClass[k].every((r, i) => Number(r.seq_no) === i + 1));
check('seq_no runs 1..n per class in date order', seqOk,
  Object.keys(byClass).map(k => k + ':' + byClass[k].map(r=>r.seq_no).join(',')).join('\n').slice(0,400));
const anchors = recs(tabs,'classes').filter(c => ['room-144','stick-to-the-script','los-discipulos'].includes(c.class_key));
check('anchors recorded on the classes rows', anchors.every(c => Number(c.rotation_anchor_seq) && Number(c.rotation_anchor_position)),
  JSON.stringify(anchors.map(c => [c.class_key, c.rotation_anchor_seq, c.rotation_anchor_position])));
reset();
const again = env.ctx.generateSlotsApply();
check('second run adds nothing', /^APPLY - 0 new/.test(again), again.split('\n')[0]);
reset();
const ver = env.ctx.generateSlotsVerify();
console.log(ver.split('\n').map(l => '     ' + l).join('\n'));
check('verify passes', ver.includes('all checks passed'), ver);

// 8. a skipped session moves nobody (Decision C, Reading B)
{
  const idx = tabs.sessions.findIndex(r => r[1] === 'room-144' && r[2] >= '2026-09-19');
  const h = tabs.sessions[0].map(x => String(x).trim().toLowerCase());
  const teachersBefore = (recs(tabs,'sessions').filter(r => r.class_key === 'room-144')).map(r => r.date_iso + '=' + r.teacher_email);
  tabs.sessions[idx + 2][h.indexOf('state')] = 'skipped';
  reset();
  env.ctx.generateSlotsApply();
  const teachersAfter = (recs(tabs,'sessions').filter(r => r.class_key === 'room-144')).map(r => r.date_iso + '=' + r.teacher_email);
  check('a skipped session leaves every later teacher where they were',
    JSON.stringify(teachersBefore) === JSON.stringify(teachersAfter));
}
// what one teacher's claim costs now that every date has a row
{
  env.S.user = E('shahad');
  reset();
  env.reads.count = 0; env.writes.count = 0;
  const r = env.ctx.claimTopic('bible-basics', 'BB-003', '2026-10-06');
  check(`a claim succeeds and costs ${env.reads.count} reads / ${env.writes.count} writes`,
    r.ok === true && env.reads.count <= 25 && env.writes.count <= 10, JSON.stringify(r).slice(0, 200));
}

// recovery: an interrupted run can leave rows appended with no seq_no. Re-running must finish it.
{
  const b2 = baseTabs();
  const m2 = makeEnv(MIG, b2, E('admin'));
  m2.ctx.migrationApply(); m2.ctx.upgradeHeadersApply(); m2.ctx.cycleStartApply();
  const e2 = makeEnv(V2 + '\n' + GEN, m2.tabs, E('admin'));
  const t2 = e2.tabs;
  vm.runInContext('_MEMO={tabs:{},names:{},cols:{}};', e2.ctx);
  e2.ctx.generateSlotsApply();
  const h = t2.sessions[0].map(x => String(x).trim().toLowerCase()), si = h.indexOf('seq_no');
  t2.sessions.forEach((r, i) => { if (i) r[si] = ''; });          // simulate the cancelled run
  vm.runInContext('_MEMO={tabs:{},names:{},cols:{}};', e2.ctx);
  const rerun = e2.ctx.generateSlotsApply();
  check('a re-run adds no rows but does finish the seq_no fill', /^APPLY - 0 new/.test(rerun) &&
    recs(t2,'sessions').every(r => Number(r.seq_no) > 0), rerun.split('\n')[0]);
  vm.runInContext('_MEMO={tabs:{},names:{},cols:{}};', e2.ctx);
  check('and verify passes afterwards', e2.ctx.generateSlotsVerify().includes('all checks passed'));
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
