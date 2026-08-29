/**
 * TNIC ANNOUNCEMENTS — Apps Script web app
 * ===========================================================================
 * Routes (all gated through ACL — see AccessControl.gs):
 *   ?page=submit   (default)  any member          announcements/submit
 *   ?page=review              review team         announcements/manage
 *   ?page=script&date=…       reader              announcements/read_script
 *   ?page=home                embed on home page  announcements/view_home
 *   ?page=access              admins              core/access_admin
 *
 * SHEET TABS (run setupAnnouncements() once to create them):
 *   items     one submitted announcement per row
 *   blocks    standing text, per service type
 *   services  the calendar of services
 *   audit     every status change
 *   access_control   created by AccessControl.gs
 *
 * DEPLOY: Execute as ME (admin account) · Access: Anyone at truenation.org
 * ===========================================================================
 */

var CFG = {
  spreadsheetId: '',                                  // paste the announcements Sheet ID
  notifyGroup:   'announcements@truenation.org',      // review team inbox
  contactEmail:  'it@truenation.org',
  orgName:       'True Nation',
  tz:            'America/Los_Angeles'
};

var TABS = { items: 'items', blocks: 'blocks', services: 'services', audit: 'audit' };

var ITEM_COLS = ['item_id','submitted_by','submitted_name','submitted_at','service_date','service_label',
                 'section','title','body','channel','contact','expires_on','home_from','home_until',
                 'home_order','home_pin','status','reviewer','review_note','sort_order','updated_at'];

var BLOCK_COLS   = ['block_id','service_type','part','section','sort_order','body','line_type','active'];
var SERVICE_COLS = ['service_date','service_type','label','reader_name','active'];
var AUDIT_COLS   = ['when','who','item_id','from_status','to_status','note'];

// ----------------------------- ROUTING -----------------------------

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'submit';
  var gate = {
    submit: ['announcements', 'submit'],
    review: ['announcements', 'manage'],
    script: ['announcements', 'read_script'],
    home:   ['announcements', 'view_home'],
    access: ['core', 'access_admin']
  }[page];

  if (!gate) return deniedPage_('That page does not exist.', page);
  if (!ACL.me()) return deniedPage_('We could not identify your account. Sign in with your @' + ACL.CFG.domain + ' account.', page);
  if (!ACL.can(gate[0], gate[1])) return deniedPage_(null, page);

  var t = HtmlService.createTemplateFromFile(page);
  t.ctx = ACL.context('announcements');
  t.params = (e && e.parameter) || {};
  return renderPage_(t, {
    submit: 'Submit an Announcement',
    review: 'Announcements Dashboard',
    script: 'Announcements — Reader Script',
    home:   'Announcements',
    access: 'Access Control'
  }[page]);
}

function renderPage_(tmpl, title) {
  return tmpl.evaluate()
    .setTitle(title + ' · ' + CFG.orgName)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function deniedPage_(message, page) {
  var t = HtmlService.createTemplateFromFile('denied');
  t.message = message || 'You do not have access to this page.';
  t.contact = CFG.contactEmail;
  t.email   = ACL.me();
  t.page    = page || '';
  return renderPage_(t, 'Access Needed');
}

function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

// ----------------------------- SHEET HELPERS -----------------------------

function book_() {
  return CFG.spreadsheetId
    ? SpreadsheetApp.openById(CFG.spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/** Read a tab as objects keyed by its header row. Never hardcode column positions. */
function readTab_(tabName) {
  var sh = book_().getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 2) return { rows: [], head: [], sheet: sh };
  var values = sh.getDataRange().getValues();
  var head = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var o = { _row: i + 1 };
    for (var c = 0; c < head.length; c++) if (head[c]) o[head[c]] = values[i][c];
    rows.push(o);
  }
  return { rows: rows, head: head, sheet: sh };
}

/** Append an object, matching the live header row and adding missing columns. */
function appendRow_(tabName, obj) {
  var sh = book_().getSheetByName(tabName);
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
               .map(function (h) { return String(h).trim(); });
  Object.keys(obj).forEach(function (k) {
    if (head.indexOf(k) === -1) { head.push(k); sh.getRange(1, head.length).setValue(k); }
  });
  var row = head.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ''; });
  sh.appendRow(row);
  return sh.getLastRow();
}

function setCell_(tabName, rowNumber, colName, value) {
  var sh = book_().getSheetByName(tabName);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
               .map(function (h) { return String(h).trim(); });
  var idx = head.indexOf(colName);
  if (idx === -1) { head.push(colName); idx = head.length - 1; sh.getRange(1, idx + 1).setValue(colName); }
  sh.getRange(rowNumber, idx + 1).setValue(value);
}

function newId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), CFG.tz, 'yyMMdd') + '-' +
         Utilities.getUuid().slice(0, 6).toUpperCase();
}

function fmtDate_(d, pattern) {
  if (!d) return '';
  var dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return Utilities.formatDate(dt, CFG.tz, pattern || 'EEE, MMM d');
}

function audit_(itemId, from, to, note) {
  try {
    appendRow_(TABS.audit, {
      when: new Date(), who: ACL.me(), item_id: itemId,
      from_status: from || '', to_status: to || '', note: note || ''
    });
  } catch (err) { /* auditing must never block the action */ }
}

// ----------------------------- SUBMIT -----------------------------

/** Everything the submission form needs to render. */
function getSubmitContext() {
  ACL.require('announcements', 'submit');
  var email = ACL.me();
  return {
    email: email,
    name: ACL.displayName(email),
    canManage: ACL.can('announcements', 'manage'),
    services: getUpcomingServices(),
    sections: getSections()
  };
}

function getUpcomingServices() {
  var data = readTab_(TABS.services);
  var today = new Date(); today.setHours(0, 0, 0, 0);
  return data.rows
    .filter(function (r) {
      if (String(r.active).toLowerCase() === 'no') return false;
      var d = r.service_date instanceof Date ? r.service_date : new Date(r.service_date);
      return !isNaN(d.getTime()) && d >= today;
    })
    .sort(function (a, b) { return new Date(a.service_date) - new Date(b.service_date); })
    .slice(0, 12)
    .map(function (r) {
      var d = r.service_date instanceof Date ? r.service_date : new Date(r.service_date);
      return {
        iso: Utilities.formatDate(d, CFG.tz, 'yyyy-MM-dd'),
        label: fmtDate_(d) + ' — ' + (r.label || r.service_type),
        type: String(r.service_type || '').toLowerCase(),
        expiresDefault: Utilities.formatDate(new Date(d.getTime() + 86400000), CFG.tz, 'yyyy-MM-dd')
      };
    });
}

/** Sections come from the standing blocks, so the two views never drift apart. */
function getSections() {
  var seen = {}, out = [];
  readTab_(TABS.blocks).rows.forEach(function (r) {
    var s = String(r.section || '').trim();
    if (s && !seen[s]) { seen[s] = true; out.push(s); }
  });
  if (out.indexOf('Announcements') === -1) out.unshift('Announcements');
  return out;
}

/**
 * Save a submission. Returns {ok:true, id:…} or throws with a readable message.
 * Everything a member sends lands here as status "Submitted" — nothing they
 * can do reaches the congregation without a manager approving it.
 */
function submitAnnouncement(data) {
  ACL.require('announcements', 'submit');
  data = data || {};

  var title = String(data.title || '').trim();
  var body  = String(data.body  || '').trim();
  var svc   = String(data.serviceIso || '').trim();
  var sect  = String(data.section || '').trim();

  if (!title) throw new Error('Add a short title.');
  if (!body)  throw new Error('Write what should be said.');
  if (body.length > 600) throw new Error('That is too long to read aloud — please shorten it to about 600 characters.');
  if (!svc)   throw new Error('Choose which service this is for.');
  if (!sect)  throw new Error('Choose where it belongs.');

  var services = getUpcomingServices();
  var match = services.filter(function (s) { return s.iso === svc; })[0];
  if (!match) throw new Error('That service is no longer on the calendar. Pick another one.');

  var email = ACL.me();
  var name  = ACL.displayName(email);
  var chan  = ['Read aloud', 'Read aloud + Home page', 'Home page'].indexOf(String(data.channel)) > -1
                ? String(data.channel) : 'Read aloud';
  var id = newId_('ANN');

  appendRow_(TABS.items, {
    item_id: id,
    submitted_by: email,
    submitted_name: name,
    submitted_at: new Date(),
    service_date: match.iso,
    service_label: match.label,
    section: sect,
    title: title,
    body: body,
    channel: chan,
    contact: String(data.contact || name).trim(),
    expires_on: String(data.expiresOn || match.expiresDefault),
    home_from: '',
    home_until: String(data.expiresOn || match.expiresDefault),
    home_order: 999,
    home_pin: 'no',
    status: 'Submitted',
    reviewer: '',
    review_note: '',
    sort_order: 999,
    updated_at: new Date()
  });

  audit_(id, '', 'Submitted', 'Submitted by ' + email);
  notifyReviewers_({ id: id, title: title, body: body, name: name, email: email,
                     service: match.label, section: sect, channel: chan });

  return { ok: true, id: id, service: match.label };
}

function notifyReviewers_(a) {
  var url = ScriptApp.getService().getUrl() + '?page=review';
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#26262A;max-width:560px">' +
    '<p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7C1316;margin:0 0 6px">' +
      CFG.orgName + ' · New announcement</p>' +
    '<h2 style="margin:0 0 10px;color:#7C1316;font-size:20px">' + escHtml_(a.title) + '</h2>' +
    '<p style="font-size:15px;line-height:1.5;background:#F4F4F5;padding:14px 16px;border-left:5px solid #C9972C;margin:0 0 14px">' +
      escHtml_(a.body) + '</p>' +
    '<table style="font-size:13px;color:#56565E" cellpadding="3">' +
      '<tr><td><b>From</b></td><td>' + escHtml_(a.name) + ' (' + escHtml_(a.email) + ')</td></tr>' +
      '<tr><td><b>Service</b></td><td>' + escHtml_(a.service) + '</td></tr>' +
      '<tr><td><b>Section</b></td><td>' + escHtml_(a.section) + '</td></tr>' +
      '<tr><td><b>Channel</b></td><td>' + escHtml_(a.channel) + '</td></tr>' +
    '</table>' +
    '<p style="margin:18px 0 0"><a href="' + url + '" style="background:#7C1316;color:#F2F2F3;' +
      'padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Review it</a></p>' +
    '</div>';
  try {
    MailApp.sendEmail({
      to: CFG.notifyGroup,
      subject: 'New announcement for review - ' + a.title,   // plain hyphen, never an em dash
      htmlBody: html,
      name: CFG.orgName + ' Intranet'
    });
  } catch (err) { /* a failed notification must not lose the submission */ }
}

function escHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ----------------------------- SETUP -----------------------------

/**
 * First run has a chicken-and-egg problem: the rule that guards setup lives in
 * the tab that setup creates. So when access_control does not exist yet we let
 * it through — at that point the spreadsheet is empty and there is nothing to
 * take. Every run after that is gated normally.
 */
function requireSetupRights_() {
  try {
    if (!book_().getSheetByName(ACL.CFG.tabName)) return;   // virgin sheet
  } catch (err) { return; }
  ACL.require('core', 'access_admin');
}

/** Run once from the editor. Creates every tab and seeds the service calendar. */
function setupAnnouncements() {
  requireSetupRights_();
  var ss = book_();
  var plan = [
    [TABS.items, ITEM_COLS], [TABS.blocks, BLOCK_COLS],
    [TABS.services, SERVICE_COLS], [TABS.audit, AUDIT_COLS]
  ];
  plan.forEach(function (p) {
    var sh = ss.getSheetByName(p[0]);
    if (!sh) {
      sh = ss.insertSheet(p[0]);
      sh.appendRow(p[1]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, p[1].length).setFontWeight('bold');
    }
  });
  ACL.ensureSheet();
  if (readTab_(TABS.services).rows.length === 0) seedServices(12);
  return 'Tabs ready: ' + Object.keys(TABS).map(function (k) { return TABS[k]; }).join(', ') + ', access_control';
}

/** Generate the next N Sabbaths so the form has dates on day one. */
function seedServices(count) {
  ACL.require('announcements', 'manage');
  var d = new Date(); d.setHours(0, 0, 0, 0);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);      // next Saturday
  for (var i = 0; i < (count || 12); i++) {
    appendRow_(TABS.services, {
      service_date: new Date(d),
      service_type: 'sabbath',
      label: 'Sabbath Class',
      reader_name: '',
      active: 'yes'
    });
    d.setDate(d.getDate() + 7);
  }
  return 'Seeded ' + (count || 12) + ' Sabbaths. Add New Moons and Feast Days by hand.';
}

/**
 * Seed the standing text from the original announcements document.
 * Typos cleaned. Deacons are Kahan and Shahad — Kabash and Kanash removed.
 * Safe to re-run: it does nothing if `blocks` already has rows.
 */
function seedBlocks() {
  ACL.require('announcements', 'manage');
  if (readTab_(TABS.blocks).rows.length > 0) return 'blocks already has content — nothing seeded.';

  var S = [
    // service_type, part, section, body, line_type
    ['all','Before class','Shalam & Welcome','Shalam everyone, and welcome to all guests and visitors.','spoken'],

    ['sabbath','Before class','Shalam & Welcome','Before we begin class, we would like to go over a few class rules.','spoken'],
    ['sabbath','Before class','Class Rules','There is no eating or drinking in the sanctuary or T.E.L.A. rooms. Closed bottles of water and items like peppermints or cough drops are acceptable.','spoken'],
    ['sabbath','Before class','Class Rules',"Once class starts, let's minimize walking back and forth and getting out of our seats.",'spoken'],
    ['sabbath','Before class','Class Rules','Parents, please make sure your children do not have iPads or toys out during class.','spoken'],
    ['sabbath','Before class','Class Rules','If you are caught sleeping or sleepy in class, you will be told to stand in the back — ages 8 and up. No one is exempt.','spoken'],
    ['sabbath','Before class','Class Rules',"Let's take pride in our chairs. They are fabric, so please keep them clean, and do not let the babies walk on them.",'spoken'],
    ['sabbath','Before class','Class Rules','Class will be streamed online on YouTube. Please be sure to like, subscribe, and share the video.','spoken'],

    ['all','After class','Guests & Visitors','To all our guests and visitors — if you have an interest in becoming a member of True Nation, you may speak with one of our deacons, Kahan or Shahad.','spoken'],

    ['sabbath','After class','Housekeeping','All congregants are responsible for reading and checking your email.','spoken'],
    ['sabbath','After class','Housekeeping','Please, no parking in the parking lot at all on Sundays. Thank you.','spoken'],
    ['sabbath','After class','Housekeeping','When leaving Sabbath class, please take all your belongings with you. Please do not leave anything behind.','spoken'],

    ['sabbath','After class','Dues & Contributions','True Nation Alms.','spoken'],
    ['sabbath','After class','Dues & Contributions','Passover Garment Dues — $50 monthly.','spoken'],
    ['sabbath','After class','Dues & Contributions','If you would like to order True Nation shirts or sweatshirts, please order through TrueNation.org/store.','spoken'],
    ['sabbath','After class','Dues & Contributions','If you have any questions regarding alms or feast fees — anything to do with money — please contact Marayam or Shanan on the finance team.','spoken'],

    ['all','After class','Announcements','Please keep an eye out for upcoming events in your emails. The events team has been doing a great job keeping us all informed. Thank you.','spoken'],

    ['feast','After class','Shalam & Welcome','Announce the feast we are celebrating today. Give praises to YHWH!','direction'],
    ['feast','After class','Feast Etiquette','If you arrive late with your dish, please drop it off quietly and avoid lingering, as others are watching the lesson.','spoken'],
    ['feast','After class','Feast Etiquette','We will be lining up outside, so please keep an ear out for instructions.','spoken'],
    ['feast','After class','Feast Etiquette','Members, please allow our guests and elders to eat first.','spoken'],
    ['feast','After class','Feast Etiquette',"Please wait to get your dessert until after everyone has gotten their food, and be mindful of the desserts — let's make sure there is enough for everyone.",'spoken'],
    ['feast','After class','Feast Etiquette','Wellness and immunity shots are in the back, along with shot glasses. Please save your shot glass — one shot only. Once everyone has had a shot, you are welcome to a second.','spoken'],
    ['feast','After class','Feast Etiquette','To all adults, please be conscious of your alcohol consumption and drink responsibly.','spoken'],
    ['feast','After class','Feast Etiquette',"Parents, let's do a better job keeping up with our little ones. With that being said, no children are allowed in the T.E.L.A. room, because they leave a mess behind.",'spoken'],
    ['feast','After class','Feast Etiquette','Make sure that you clean up after yourselves and your children.','spoken'],

    ['sabbath','After class','Closing','Refreshments to follow. We have food and drinks available for everyone in the Rec room after we send up our closing prayers. Please allow guests and elders to eat first.','spoken'],
    ['sabbath','After class','Closing',"Remember that some of our children have severe food allergies. Do not feed any child without the parent's permission.",'spoken'],
    ['sabbath','After class','Closing','On behalf of Hospitality, thank you all for your contributions — we could not do this without you. Please be sure to check your emails and contribute on the days you are assigned.','spoken'],

    ['newmoon','After class','Closing','Refreshments to follow. Please allow guests and elders to eat first.','spoken'],

    ['feast','After class','Closing','Give thanks to everyone that contributed to the feast today.','spoken'],
    ['feast','After class','Closing','Encourage everyone to be festive and in good spirits.','direction']
  ];

  // One running counter across the whole list, so the array order above IS the
  // reading order. Per-section counters would tie between 'all' and type rows.
  var n = 0;
  S.forEach(function (r) {
    n += 10;                                   // gaps leave room to insert later
    appendRow_(TABS.blocks, {
      block_id: newId_('BLK'),
      service_type: r[0], part: r[1], section: r[2],
      sort_order: n, body: r[3], line_type: r[4], active: 'yes'
    });
  });
  return 'Seeded ' + S.length + ' standing lines.';
}
