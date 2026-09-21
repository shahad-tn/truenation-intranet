const vm = require('vm'), fs = require('fs');
const RealDate = Date, FIXED = new RealDate(2026, 8, 19, 12, 0, 0).getTime();
class FDate extends RealDate { constructor(...a) { if (!a.length) super(FIXED); else super(...a); } static now(){ return FIXED; } }
const E = x => x + '@truenation.org';

function baseTabs() { return {
  bible_basics_topics: [
    ['topic_id','topic_name','scripture_refs','description','status','claimed_by_email','claimed_by_name','claimed_at','teach_date','notes'],
    ['BB-001','Creation','Gen 1','d1','Claimed',E('shahad'),'S','2026-09-01','2026-09-22','n1'],
    ['BB-002','Fall','Gen 3','d2','Claimed',E('raiyah'),'R','2026-09-01','2026-09-29',''],
    ['BB-003','Flood','Gen 6','d3','Open','','','','',''],
    ['','','','','','','','','',''],
    ['BB-004','Babel','Gen 11','d4','Claimed',E('bayan'),'B','2026-09-02','',''],
    ['BB-005','Abraham','Gen 12','d5','Open','','','','',''],
  ],
  world_history_topics: [
    ['topic_id','topic_name','teach_order','scripture_refs','description'],
    ['WH-027','Egypt',27,'r',''],['WH-028','Canaan',28,'',''],['WH-029','Saul',29,'','d'],
  ],
  class_config: [['class_key','nth','teacher_email'],['bible-basics',1,E('shahad')],['world-history',1,E('ahmanahla')]],
  overrides: [
    ['class_key','date_iso','teacher_email','topic_id','canceled','note','updated_by','updated_at'],
    ['world-history','2026-09-23',E('ahmanahla'),'WH-028',false,'sub',E('admin'),'2026-09-10'],
    ['bible-basics','2026-09-22',E('mathathyah'),'',false,'covering',E('admin'),'2026-09-11'],
    ['room-144','2026-10-02','','',true,'feast',E('admin'),'2026-09-12'],
    ['ghost-class','2026-10-09','','',false,'',E('admin'),'2026-09-12'],
    ['world-history','','','',false,'no date',E('admin'),'2026-09-12'],
  ],
}; }

function makeEnv(code, tabsInit, user) {
  const tabs = JSON.parse(JSON.stringify(tabsInit)), S = { user }, logs = [];
  const writes = { count: 0, detail: [] };   // every round trip a real Sheet would make
  const props = {};                          // Apps Script Script Properties
  const reads = { count: 0, detail: [] };    // getValues / getLastRow / getLastColumn are round trips too
  const groups = { 'tn-admin@truenation.org': [E('admin')], 'apostles@truenation.org': [], 'bishops@truenation.org': [], 'moreh@truenation.org': ['admin','shahad','shamaryah','izarahla','ash','banayah','a','b','c','d','w'].map(E) };
  const pad = (r, n) => { while (r.length < n) r.push(''); return r; };
  function sheet(name) {
    const d = tabs[name], width = () => Math.max(...d.map(r => r.length), 1);
    return {
      getName: () => name,
      getDataRange: () => ({ getValues: () => { reads.count++; reads.detail.push('getDataRange ' + name); return d.map(r => pad(r.slice(), width())); } }),
      getRange: (r, c, nr = 1, nc = 1) => ({
        getValues: () => { reads.count++; reads.detail.push('getRange ' + name); const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push((d[r-1+i] || [])[c-1+j] ?? ''); o.push(row); } return o; },
        setValue: v => { writes.count++; writes.detail.push('setValue ' + name); while (d.length < r) d.push([]); pad(d[r-1], c); d[r-1][c-1] = v; },
        setValues: vs => { writes.count++; writes.detail.push('setValues ' + name + ' x' + vs.length); vs.forEach((row, i) => { while (d.length < r + i) d.push([]); row.forEach((v, j) => { pad(d[r-1+i], c+j); d[r-1+i][c-1+j] = v; }); }); },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { pad(d[r-1+i], c+j); d[r-1+i][c-1+j] = ''; } },
      }),
      getLastRow: () => { reads.count++; reads.detail.push('getLastRow ' + name); return d.length; },
      getLastColumn: () => { reads.count++; reads.detail.push('getLastColumn ' + name); return width(); }, setFrozenRows: () => {},
      setName: n2 => { tabs[n2] = d; delete tabs[name]; },
      appendRow: row => { writes.count++; writes.detail.push('appendRow ' + name); d.push(row.slice()); },
      deleteRow: r => { writes.count++; writes.detail.push('deleteRow ' + name); d.splice(r - 1, 1); },
    };
  }
  const ctx = { Date: FDate, console, Math, JSON, String, Number, Object, Array, Error,
    Session: { getActiveUser: () => ({ getEmail: () => S.user }) },
    SpreadsheetApp: { openById: () => ({
        getSheetByName: n => tabs[n] ? sheet(n) : null,
        insertSheet: n => { tabs[n] = [[]]; return sheet(n); } }), flush: () => {} },
    AdminDirectory: { Members: { get: (g, e) => { if (!(groups[g] || []).includes(e)) throw new Error('nm'); return {}; } },
      Users: { get: e => ({ name: { fullName: 'N ' + e.split('@')[0] } }) } },
    GroupsApp: { getGroupByEmail: () => ({ hasUser: () => false }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    MailApp: { sendEmail: () => {} }, Logger: { log: m => logs.push(m) }, HtmlService: {},
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props[k] === undefined ? null : props[k]),
      setProperty: (k, v) => { props[k] = v },
    }) },
    ContentService: { MimeType: { JSON: 'application/json' },
      createTextOutput: (t) => ({ body: t, setMimeType() { return this } }) } };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  return { ctx, tabs, S, logs, writes, reads, props };
}
const recs = (tabs, name) => {
  const rows = tabs[name]; if (!rows) return [];
  const h = rows[0].map(x => String(x).trim().toLowerCase());
  return rows.slice(1).map(r => { const o = {}; h.forEach((k, i) => { if (k) o[k] = r[i] ?? ''; }); return o; });
};
