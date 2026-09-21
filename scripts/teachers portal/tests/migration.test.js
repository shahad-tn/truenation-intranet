const code = process.argv.slice(2).map(f => fs.readFileSync(f, 'utf8')).join('\n');
let fails = 0;
const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) { fails++; if (extra !== undefined) console.log('     ' + String(extra).slice(0, 1200)); } };

// 1. non-admin is refused
let env = makeEnv(code, baseTabs(), E('shahad'));
let msg = ''; try { env.ctx.migrationPreview(); } catch (e) { msg = e.message; }
check('non-admin refused', /^Admin access required/.test(msg), msg);

// 2. preview writes nothing
env = makeEnv(code, baseTabs(), E('admin'));
const before = JSON.stringify(env.tabs);
const prev = env.ctx.migrationPreview();
check('preview writes nothing', JSON.stringify(env.tabs) === before);
check('preview names every tab', ['classes','class_teachers','topics','reader_pairs','sessions','config'].every(t => prev.includes(t + ':')), prev);
console.log(prev.split('\n').map(l => '     ' + l).join('\n'));

// 3. apply
const applied = env.ctx.migrationApply();
const T = env.tabs;
check('old tabs untouched by apply', ['bible_basics_topics','world_history_topics','class_config','overrides']
  .every(t => JSON.stringify(T[t]) === JSON.stringify(JSON.parse(before)[t])));
check('topics = 5 BB + 3 WH', recs(T,'topics').length === 8, recs(T,'topics').length);
check('topics carry class_key + teach_order only where it exists',
  recs(T,'topics').filter(r => r.class_key === 'world-history').every(r => r.teach_order) &&
  recs(T,'topics').filter(r => r.class_key === 'bible-basics').every(r => r.teach_order === ''));
check('blank catalogue row skipped', !recs(T,'topics').some(r => !r.topic_id));
check('classes = 10, teachers = 14, pairs = 14',
  recs(T,'classes').length === 10 && recs(T,'class_teachers').length === 14 && recs(T,'reader_pairs').length === 14,
  [recs(T,'classes').length, recs(T,'class_teachers').length, recs(T,'reader_pairs').length]);

const S = recs(T,'sessions');
console.log('     sessions built:'); S.forEach(r => console.log(`       ${r.class_key} ${r.date_iso} topic=${r.topic_id||'-'} teacher=${(r.teacher_email||'-').split('@')[0]} reader=${(r.reader_email||'-').split('@')[0]} src=${r.reader_source||'-'} state=${r.state}`));

check('claim + override on same date merged into ONE row',
  S.filter(r => r.class_key === 'bible-basics' && r.date_iso === '2026-09-22').length === 1);
const merged = S.find(r => r.class_key === 'bible-basics' && r.date_iso === '2026-09-22');
check('merged row keeps the topic and takes the substitute teacher',
  merged.topic_id === 'BB-001' && merged.teacher_email === E('mathathyah'), JSON.stringify(merged));
check('reader re-resolved for the substitute via pair table',
  merged.reader_email === E('iyanahrayahla') && merged.reader_source === 'pair', merged.reader_email);
check('fixed-reader class would use fixed source', (() => {
  const r = env.ctx.mig_reader_('blue-strip', E('yashami')); return r.email === E('izarahla') && r.source === 'fixed'; })());
check('canceled override -> state skipped', (S.find(r => r.class_key === 'room-144') || {}).state === 'skipped');
check('unknown class skipped with a warning', !S.some(r => r.class_key === 'ghost-class') && applied.includes('unknown class'));
check('claim with no teach_date warned, not migrated', applied.includes('BB-004') && !S.some(r => r.topic_id === 'BB-004'));
check('overrides row with no date warned', applied.includes('no date'));
check('seq_no left blank for step 2', S.every(r => r.seq_no === ''));
check('session_id is class+date', S.every(r => r.session_id === r.class_key + '-' + r.date_iso));

// 4. verify
const ver = env.ctx.migrationVerify();
console.log(ver.split('\n').map(l => '     ' + l).join('\n'));
check('verify passes after apply', ver.includes('all checks passed'), ver);

// 5. idempotency
const snapshot = JSON.stringify(env.tabs);
const again = env.ctx.migrationApply();
check('second apply refuses', again.startsWith('REFUSED'), again);
check('second apply changed nothing', JSON.stringify(env.tabs) === snapshot);

// 6. verify catches a broken sheet
const env2 = makeEnv(code, baseTabs(), E('admin'));
env2.ctx.migrationApply();
env2.tabs.sessions.push(env2.tabs.sessions[1].slice());   // duplicate class+date
env2.tabs.topics.splice(1, 1);                            // lose a topic
const ver2 = env2.ctx.migrationVerify();
check('verify catches a duplicate and a missing topic',
  /FAIL {2}sessions: .*1 duplicate/.test(ver2) && /FAIL {2}topics/.test(ver2), ver2);

// 7. missing source tab is a warning, not a crash
const t3 = baseTabs(); delete t3.world_history_topics;
const env3 = makeEnv(code, t3, E('admin'));
let r3 = ''; try { r3 = env3.ctx.migrationApply(); } catch (e) { r3 = 'THREW ' + e.message; }
check('missing source tab warns and continues', r3.includes('not found') && recs(env3.tabs,'topics').length === 5, r3);

// 8. admin check without the Admin SDK advanced service (fresh project): falls back to GroupsApp
{
  const envA = makeEnv(code, baseTabs(), E('admin'));
  delete envA.ctx.AdminDirectory;
  envA.ctx.GroupsApp = { getGroupByEmail: g => ({ hasUser: e => g === 'tn-admin@truenation.org' && e === E('admin') }) };
  let ok = true, m = '';
  try { envA.ctx.migrationPreview(); } catch (e) { ok = false; m = e.message; }
  check('runs with no Admin SDK, using GroupsApp', ok, m);

  const envB = makeEnv(code, baseTabs(), E('shahad'));
  delete envB.ctx.AdminDirectory;
  envB.ctx.GroupsApp = { getGroupByEmail: () => ({ hasUser: () => false }) };
  let m2 = ''; try { envB.ctx.migrationPreview(); } catch (e) { m2 = e.message; }
  check('non-admin still refused on that path', /Admin access required/.test(m2), m2);

  const envC = makeEnv(code, baseTabs(), E('admin'));
  delete envC.ctx.AdminDirectory;
  envC.ctx.GroupsApp = { getGroupByEmail: () => { throw new Error('not authorised'); } };
  let m3 = ''; try { envC.ctx.migrationPreview(); } catch (e) { m3 = e.message; }
  check('refuses when neither service can answer', /Admin access required/.test(m3), m3);
}


