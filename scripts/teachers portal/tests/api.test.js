
// ===== 2.1: what the portal can do through the Apps Script API =====
//
// scripts.run impersonates the signed-in person, so Session.getActiveUser() IS them and the
// functions are called directly - exactly as these tests call them. There is no secret and no
// actor argument to forge; env.S.user below stands in for who Google says is calling.
const ser2 = v => JSON.stringify(v)
const V2 = fs.readFileSync('code.gs', 'utf8')
const GEN = fs.readFileSync('generate_slots.gs', 'utf8')
const MIG = fs.readFileSync('migrate_scheduling.gs', 'utf8')
let fails = 0
const check = (n, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) { fails++; if (x !== undefined) console.log('     ' + String(x).slice(0, 800)) } }

function world() {
  const m = makeEnv(MIG, baseTabs(), E('admin'))
  m.ctx.migrationApply(); m.ctx.upgradeHeadersApply(); m.ctx.cycleStartApply()
  const env = makeEnv(V2 + '\n' + GEN, m.tabs, E('admin'))
  vm.runInContext('_MEMO={tabs:{},names:{},cols:{}};', env.ctx)
  env.ctx.generateSlotsApply()
  return env
}
// call fn as this person, the way scripts.run does
const as = (env, user, fn, ...args) => {
  env.S.user = user
  vm.runInContext('_MEMO={tabs:{},names:{},cols:{}};', env.ctx)
  try { return env.ctx[fn](...args) } catch (e) { return { ok: false, threw: e.message } }
}
// the first upcoming date for a class, optionally one that is still free
const dateOf = (env, cls, freeOnly) => recs(env.tabs, 'sessions')
  .filter(r => r.class_key === cls && r.date_iso >= todayIso())
  .filter(r => (freeOnly ? !r.topic_id && !r.owner_email : true))
  .map(r => r.date_iso).sort()[0]
function todayIso() { const d = new Date(); return d.toISOString().slice(0, 10) }


// ── identity and gating ──
{
  const env = world()
  const p = as(env, E('shahad'), 'apiPing')
  check('apiPing reports the caller Google says it is', p.ok === true && p.activeUser === E('shahad'), ser2(p))
  check('apiEcho needs nothing at all', as(env, E('shahad'), 'apiEcho') === 'hello')
  check('group membership resolves for the caller', p.isMoreh === true && p.isAdmin === false, ser2(p))
  check('admin is recognised', as(env, E('admin'), 'apiPing').isAdmin === true)

  // Anyone in the domain could in principle reach the API, so each function gates itself.
  const stranger = 'nobody@truenation.org'
  const d = dateOf(env, 'room-144')
  check('a non-member cannot submit a title',
    as(env, stranger, 'submitTitle', 'room-144', d, { title: 'x' }).reason === 'You are not authorized to edit class details.')
  check('a non-member cannot claim', as(env, stranger, 'claimTopic', 'bible-basics', 'BB-003', dateOf(env, 'bible-basics', true)).ok === false)
  check('a non-member cannot substitute', as(env, stranger, 'grabDate', 'room-144', d).ok === false)
  check('a non-member cannot release a topic', as(env, stranger, 'releaseTopic', 'bible-basics', 'BB-001').reason === 'You are not authorized.')
  check('a non-member cannot give back a date', as(env, stranger, 'releaseDate', 'room-144', d).reason === 'You are not authorized.')
  check('a non-member cannot reach admin functions', as(env, stranger, 'adminSetRotation', 'room-144', 1, E('ash')).threw === 'Admin access required.')
}

// ── titles ──
{
  const env = world()
  const d = dateOf(env, 'room-144')
  const r = as(env, E('shahad'), 'submitTitle', 'room-144', d, { title: 'Guard Your Gates', anchorScripture: 'Prov 4:23' })
  check('a title saves', r.ok === true, ser2(r).slice(0, 200))
  const row = () => recs(env.tabs, 'sessions').find(x => x.class_key === 'room-144' && x.date_iso === d)
  check('title and scripture land in the right row', row().title === 'Guard Your Gates' && row().anchor_scripture === 'Prov 4:23', ser2(row()).slice(0, 240))
  check('updated_by records WHO edited it', String(row().updated_by).toLowerCase() === E('shahad'), row().updated_by)
  check('a field not sent is left alone', row().description === '')
  check("an admin can edit someone else's session",
    as(env, E('admin'), 'submitTitle', 'room-144', d, { description: 'A study on discipline.' }).ok === true && row().description === 'A study on discipline.')
  check('and the earlier title survives a partial edit', row().title === 'Guard Your Gates')
  check('any moreh member may edit any session (Shahad, 2026-09-20)',
    as(env, E('izarahla'), 'submitTitle', 'room-144', d, { title: 'Reworded' }).ok === true && row().title === 'Reworded')
  check('a date with no session is refused',
    as(env, E('shahad'), 'submitTitle', 'room-144', '2030-01-01', { title: 'x' }).reason === 'There is no session for that class on that date.')
  check('an unknown class is refused', /Unknown class/.test(as(env, E('shahad'), 'submitTitle', 'nope', d, { title: 'x' }).threw || ''))
  check('an empty edit is refused', as(env, E('shahad'), 'submitTitle', 'room-144', d, {}).reason === 'Nothing to save.')
  check('a title can be cleared deliberately',
    as(env, E('shahad'), 'submitTitle', 'room-144', d, { title: '' }).ok === true && row().title === '')
}

// ── claims ──
{
  const env = world()
  const bbDate = dateOf(env, 'bible-basics', true)
  check('claimTopic works', as(env, E('shahad'), 'claimTopic', 'bible-basics', 'BB-003', bbDate).ok === true)
  const claimed = recs(env.tabs, 'sessions').find(x => x.class_key === 'bible-basics' && x.date_iso === bbDate)
  check('the claim is recorded against the caller', String(claimed.owner_email).toLowerCase() === E('shahad'), ser2(claimed).slice(0, 200))
  check('a second claim of the same topic is refused',
    as(env, E('admin'), 'claimTopic', 'bible-basics', 'BB-003', dateOf(env, 'bible-basics', true)).ok === false)
  check('releaseTopic works', as(env, E('shahad'), 'releaseTopic', 'bible-basics', 'BB-003').ok === true)
}
// ── substitutes, including for the eight classes that have no topic catalogue ──
{
  const env = world()
  const d = dateOf(env, 'deaconstruction')
  const before = recs(env.tabs, 'sessions').find(r => r.class_key === 'deaconstruction' && r.date_iso === d)
  check('the slot starts with its rotation teacher', String(before.teacher_email).toLowerCase() === E('shamaryah'), before.teacher_email)
  const grab = as(env, E('shahad'), 'grabDate', 'deaconstruction', d)
  check('a substitute can take a class that has no topics', grab.ok === true, ser2(grab).slice(0, 200))
  const after = recs(env.tabs, 'sessions').find(r => r.class_key === 'deaconstruction' && r.date_iso === d)
  check('teacher changes but the owner does not', String(after.teacher_email).toLowerCase() === E('shahad') &&
    String(after.owner_email).toLowerCase() === E('shamaryah'), ser2([after.teacher_email, after.owner_email]))
  check('someone else cannot take it from the substitute',
    as(env, E('admin'), 'grabDate', 'deaconstruction', d).ok === false)
  check('the owner CAN take it back',
    as(env, E('shamaryah'), 'grabDate', 'deaconstruction', d).ok === true)
  const back = recs(env.tabs, 'sessions').find(r => r.class_key === 'deaconstruction' && r.date_iso === d)
  check('and it returns to the owner', String(back.teacher_email).toLowerCase() === E('shamaryah'), back.teacher_email)
  check('a skipped session cannot be grabbed', (() => {
    const h = env.tabs.sessions[0].map(x => String(x).trim().toLowerCase())
    const i = env.tabs.sessions.findIndex(r => r[h.indexOf('class_key')] === 'blue-strip' && r[h.indexOf('date_iso')] >= todayIso())
    env.tabs.sessions[i][h.indexOf('state')] = 'skipped'
    const dd = env.tabs.sessions[i][h.indexOf('date_iso')]
    return as(env, E('shahad'), 'grabDate', 'blue-strip', dd).reason === 'That class is canceled.'
  })())
  check('a date with no slot cannot be grabbed',
    as(env, E('shahad'), 'grabDate', 'room-144', '2030-05-05')
      .reason === 'There is no class scheduled that day to teach.')
}


console.log(fails ? fails + ' FAILED' : 'ALL PASSED')
process.exit(fails ? 1 : 0)
