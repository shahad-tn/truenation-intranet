/**
 * TNIC ANNOUNCEMENTS — server functions for review, reader script and home feed
 * ===========================================================================
 * Every function that writes calls ACL.require() first. Hiding a button in the
 * UI does not stop anyone who knows the function name.
 * ===========================================================================
 */

var STATUSES = ['Submitted', 'Needs Info', 'Approved', 'Denied', 'Read', 'Archived'];

// ----------------------------- SHARED -----------------------------

function findItem_(itemId) {
  var data = readTab_(TABS.items);
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i].item_id) === String(itemId)) return data.rows[i];
  }
  throw new Error('That announcement no longer exists.');
}

function today_() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }

function isoDate_(d) {
  if (!d) return '';
  var dt = (d instanceof Date) ? d : new Date(d);
  return isNaN(dt.getTime()) ? '' : Utilities.formatDate(dt, CFG.tz, 'yyyy-MM-dd');
}

function dateOnly_(v) {
  if (!v) return null;
  var d = (v instanceof Date) ? new Date(v) : new Date(String(v) + 'T12:00:00');
  if (isNaN(d.getTime())) { d = new Date(v); }
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function shortAgo_(when) {
  var d = dateOnly_(when) ? new Date(when) : null;
  if (!d || isNaN(d.getTime())) return '';
  var mins = Math.round((new Date() - d) / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : mins + ' minutes ago';
  var hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  var days = Math.round(hrs / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

function isHomeChannel_(channel) {
  return String(channel).indexOf('Home page') > -1;
}

// ----------------------------- REVIEW QUEUE -----------------------------

function getReviewState() {
  ACL.require('announcements', 'manage');

  var items = readTab_(TABS.items).rows.map(function (r) {
    return {
      id: String(r.item_id),
      title: String(r.title || ''),
      body: String(r.body || ''),
      by: String(r.submitted_name || r.submitted_by || ''),
      email: String(r.submitted_by || ''),
      section: String(r.section || 'Announcements'),
      serviceIso: isoDate_(r.service_date),
      serviceLabel: String(r.service_label || fmtDate_(r.service_date)),
      channel: String(r.channel || 'Read aloud'),
      contact: String(r.contact || ''),
      expires: isoDate_(r.expires_on),
      status: String(r.status || 'Submitted'),
      note: String(r.review_note || ''),
      reviewer: String(r.reviewer || ''),
      submitted: shortAgo_(r.submitted_at)
    };
  });

  // Newest service first inside each group; unscheduled last.
  items.sort(function (a, b) {
    if (a.serviceIso === b.serviceIso) return a.title.localeCompare(b.title);
    return String(a.serviceIso).localeCompare(String(b.serviceIso));
  });

  return {
    items: items,
    services: getServicesWithCounts(),
    sections: getSections(),
    statuses: STATUSES,
    me: ACL.displayName(ACL.me())
  };
}

function getServicesWithCounts() {
  ACL.require('announcements', 'manage');
  var services = getUpcomingServices();
  var items = readTab_(TABS.items).rows;
  return services.map(function (s) {
    var approved = 0, pending = 0;
    items.forEach(function (r) {
      if (isoDate_(r.service_date) !== s.iso) return;
      var st = String(r.status || '');
      if (st === 'Approved' || st === 'Read') approved++;
      else if (st === 'Submitted' || st === 'Needs Info') pending++;
    });
    return { iso: s.iso, label: s.label, type: s.type, approved: approved, pending: pending };
  });
}

/**
 * Move one item to a new status. A denial or an info request must carry a note —
 * a decision with no explanation is how you train people to stop submitting.
 */
function setItemStatus(itemId, status, note) {
  ACL.require('announcements', 'manage');
  if (STATUSES.indexOf(status) === -1) throw new Error('Unknown status: ' + status);

  var item = findItem_(itemId);
  var from = String(item.status || '');
  note = String(note || '').trim();

  if ((status === 'Denied' || status === 'Needs Info') && !note) {
    throw new Error(status === 'Denied'
      ? 'Add a short reason. It gets emailed to the person who submitted it.'
      : 'Say what you need from them.');
  }

  var stamped = note ? (note + ' — ' + ACL.displayName(ACL.me()) + ', ' + fmtDate_(new Date(), 'MMM d')) : '';

  setCell_(TABS.items, item._row, 'status', status);
  setCell_(TABS.items, item._row, 'reviewer', ACL.me());
  setCell_(TABS.items, item._row, 'updated_at', new Date());
  if (note) setCell_(TABS.items, item._row, 'review_note', stamped);
  if (status === 'Approved') setCell_(TABS.items, item._row, 'review_note', '');

  // First approval of a home-page item starts its run today.
  if (status === 'Approved' && isHomeChannel_(item.channel) && !String(item.home_from || '').trim()) {
    setCell_(TABS.items, item._row, 'home_from', isoDate_(today_()));
  }

  audit_(itemId, from, status, note);
  notifySubmitter_(item, status, stamped);

  return { ok: true, id: itemId, status: status, note: stamped };
}

function updateItemText(itemId, title, body) {
  ACL.require('announcements', 'manage');
  var item = findItem_(itemId);
  title = String(title || '').trim();
  body = String(body || '').trim();
  if (!title || !body) throw new Error('Title and text are both required.');
  if (body.length > 600) throw new Error('Too long to read aloud — keep it under 600 characters.');

  setCell_(TABS.items, item._row, 'title', title);
  setCell_(TABS.items, item._row, 'body', body);
  setCell_(TABS.items, item._row, 'updated_at', new Date());
  audit_(itemId, item.status, item.status, 'Text edited by ' + ACL.me());
  return { ok: true };
}

function notifySubmitter_(item, status, note) {
  var to = String(item.submitted_by || '').trim();
  if (!to) return;
  var word = {
    'Approved':  'approved',
    'Denied':    'not being read this service',
    'Needs Info':'waiting on more detail from you'
  }[status];
  if (!word) return;

  var body =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#26262A;max-width:560px">' +
    '<p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7C1316;margin:0 0 6px">' +
      CFG.orgName + ' &middot; Announcements</p>' +
    '<h2 style="margin:0 0 6px;color:#7C1316;font-size:20px">' + escHtml_(item.title) + '</h2>' +
    '<p style="font-size:15px;margin:0 0 14px">Your announcement is <b>' + word + '</b>.</p>' +
    (note ? '<p style="font-size:14px;line-height:1.5;background:#E8E8EC;padding:13px 15px;' +
            'border-left:5px solid #C9972C;margin:0 0 14px">' + escHtml_(note) + '</p>' : '') +
    (status === 'Approved'
      ? '<p style="font-size:14px;color:#56565E;margin:0">It will be read at ' + escHtml_(item.service_label) + '.</p>'
      : '<p style="font-size:14px;color:#56565E;margin:0">Reply to this email or contact ' + CFG.notifyGroup + ' with questions.</p>') +
    '</div>';

  try {
    MailApp.sendEmail({
      to: to,
      replyTo: CFG.notifyGroup,
      subject: 'Your announcement - ' + item.title,   // plain hyphen only
      htmlBody: body,
      name: CFG.orgName + ' Intranet'
    });
  } catch (err) { /* never block the review action on a mail failure */ }
}

// ----------------------------- STANDING TEXT -----------------------------

function getBlocks(serviceType) {
  ACL.require('announcements', 'manage');
  serviceType = String(serviceType || 'sabbath').toLowerCase();

  var rows = readTab_(TABS.blocks).rows.filter(function (r) {
    if (String(r.active).toLowerCase() === 'no') return false;
    var t = String(r.service_type || 'all').toLowerCase();
    return t === serviceType || t === 'all';
  });

  rows.sort(function (a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); });

  // Group into part -> section -> lines, preserving first-seen order.
  var parts = [], pIdx = {};
  rows.forEach(function (r) {
    var partName = String(r.part || 'After class');
    var secName  = String(r.section || 'Announcements');
    if (!(partName in pIdx)) { pIdx[partName] = parts.length; parts.push({ part: partName, sections: [], _s: {} }); }
    var p = parts[pIdx[partName]];
    if (!(secName in p._s)) { p._s[secName] = p.sections.length; p.sections.push({ name: secName, lines: [] }); }
    p.sections[p._s[secName]].lines.push({
      id: String(r.block_id),
      text: String(r.body || ''),
      direction: String(r.line_type || '').toLowerCase() === 'direction',
      order: Number(r.sort_order) || 0
    });
  });
  parts.forEach(function (p) { delete p._s; });
  return { serviceType: serviceType, parts: parts };
}

function saveBlockLine(blockId, text, isDirection) {
  ACL.require('announcements', 'manage');
  var data = readTab_(TABS.blocks);
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i].block_id) === String(blockId)) {
      if (!String(text || '').trim()) throw new Error('The line cannot be empty. Use Remove instead.');
      setCell_(TABS.blocks, data.rows[i]._row, 'body', String(text).trim());
      setCell_(TABS.blocks, data.rows[i]._row, 'line_type', isDirection ? 'direction' : 'spoken');
      return { ok: true };
    }
  }
  throw new Error('That line no longer exists.');
}

function addBlockLine(serviceType, part, section, text, isDirection) {
  ACL.require('announcements', 'manage');
  if (!String(text || '').trim()) throw new Error('Write the line first.');
  var rows = readTab_(TABS.blocks).rows.filter(function (r) {
    return String(r.service_type).toLowerCase() === String(serviceType).toLowerCase() &&
           String(r.section) === String(section);
  });
  var max = 0;
  rows.forEach(function (r) { max = Math.max(max, Number(r.sort_order) || 0); });

  appendRow_(TABS.blocks, {
    block_id: newId_('BLK'),
    service_type: String(serviceType).toLowerCase(),
    part: String(part || 'After class'),
    section: String(section),
    sort_order: max + 1,
    body: String(text).trim(),
    line_type: isDirection ? 'direction' : 'spoken',
    active: 'yes'
  });
  return { ok: true };
}

function removeBlockLine(blockId) {
  ACL.require('announcements', 'manage');
  var data = readTab_(TABS.blocks);
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i].block_id) === String(blockId)) {
      setCell_(TABS.blocks, data.rows[i]._row, 'active', 'no');   // soft delete, keeps history
      return { ok: true };
    }
  }
  throw new Error('That line no longer exists.');
}

function moveBlockLine(blockId, direction) {
  ACL.require('announcements', 'manage');
  var data = readTab_(TABS.blocks);
  var self = null;
  data.rows.forEach(function (r) { if (String(r.block_id) === String(blockId)) self = r; });
  if (!self) throw new Error('That line no longer exists.');

  var siblings = data.rows.filter(function (r) {
    return String(r.section) === String(self.section) &&
           String(r.service_type) === String(self.service_type) &&
           String(r.active).toLowerCase() !== 'no';
  }).sort(function (a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); });

  var pos = -1;
  siblings.forEach(function (r, i) { if (String(r.block_id) === String(blockId)) pos = i; });
  var swap = siblings[direction === 'up' ? pos - 1 : pos + 1];
  if (!swap) return { ok: true };

  var a = Number(self.sort_order) || 0, b = Number(swap.sort_order) || 0;
  if (a === b) { a = pos; b = (direction === 'up' ? pos - 1 : pos + 1); }
  setCell_(TABS.blocks, self._row, 'sort_order', b);
  setCell_(TABS.blocks, swap._row, 'sort_order', a);
  return { ok: true };
}

// ----------------------------- READER SCRIPT -----------------------------

/**
 * Assemble one service: standing blocks for that service type, with approved
 * items dropped into their section. This is the only place the two merge.
 */
function getScriptFor(dateIso) {
  ACL.require('announcements', 'read_script');

  var services = readTab_(TABS.services).rows;
  var svc = null;
  services.forEach(function (r) { if (isoDate_(r.service_date) === String(dateIso)) svc = r; });
  if (!svc) {
    var upcoming = getUpcomingServices();
    if (!upcoming.length) throw new Error('There are no services on the calendar yet.');
    dateIso = upcoming[0].iso;
    services.forEach(function (r) { if (isoDate_(r.service_date) === dateIso) svc = r; });
  }
  if (!svc) throw new Error('That service is not on the calendar.');

  var type = String(svc.service_type || 'sabbath').toLowerCase();

  // Standing text, grouped exactly as the dashboard shows it.
  var blocks = (function () {
    var rows = readTab_(TABS.blocks).rows.filter(function (r) {
      if (String(r.active).toLowerCase() === 'no') return false;
      var t = String(r.service_type || 'all').toLowerCase();
      return t === type || t === 'all';
    });
    rows.sort(function (a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); });
    var parts = [], pIdx = {};
    rows.forEach(function (r) {
      var partName = String(r.part || 'After class');
      var secName  = String(r.section || 'Announcements');
      if (!(partName in pIdx)) { pIdx[partName] = parts.length; parts.push({ part: partName, sections: [], _s: {} }); }
      var p = parts[pIdx[partName]];
      if (!(secName in p._s)) { p._s[secName] = p.sections.length; p.sections.push({ name: secName, lines: [], hasSubmitted: false }); }
      p.sections[p._s[secName]].lines.push({
        text: String(r.body || ''),
        direction: String(r.line_type || '').toLowerCase() === 'direction',
        submitted: false
      });
    });
    return { parts: parts, index: pIdx };
  })();

  // Approved items for this date, slotted into their section.
  var approved = readTab_(TABS.items).rows.filter(function (r) {
    var st = String(r.status || '');
    return isoDate_(r.service_date) === dateIso &&
           (st === 'Approved' || st === 'Read') &&
           String(r.channel || '').indexOf('Read aloud') > -1;
  }).sort(function (a, b) { return (Number(a.sort_order) || 999) - (Number(b.sort_order) || 999); });

  approved.forEach(function (r) {
    var secName = String(r.section || 'Announcements');
    if (secName === 'Not sure') secName = 'Announcements';
    var placed = false;
    blocks.parts.forEach(function (p) {
      p.sections.forEach(function (s) {
        if (!placed && s.name === secName) {
          s.lines.push({
            text: String(r.body || ''), direction: false, submitted: true,
            by: String(r.submitted_name || r.submitted_by || ''), contact: String(r.contact || '')
          });
          s.hasSubmitted = true;
          placed = true;
        }
      });
    });
    if (!placed) {
      // No standing section by that name — make one at the end of the last part.
      var last = blocks.parts[blocks.parts.length - 1];
      if (!last) { blocks.parts.push({ part: 'After class', sections: [] }); last = blocks.parts[0]; }
      last.sections.push({
        name: secName, hasSubmitted: true,
        lines: [{ text: String(r.body || ''), direction: false, submitted: true,
                  by: String(r.submitted_name || r.submitted_by || ''), contact: String(r.contact || '') }]
      });
    }
  });

  blocks.parts.forEach(function (p) { delete p._s; });

  return {
    dateIso: dateIso,
    type: type,
    title: String(svc.label || svc.service_type || 'Service'),
    dateLabel: fmtDate_(svc.service_date, 'EEEE, MMMM d, yyyy'),
    reader: String(svc.reader_name || ''),
    parts: blocks.parts,
    services: getUpcomingServices(),
    canManage: ACL.can('announcements', 'manage')
  };
}

/** Mark everything approved for a service as Read, once it has been delivered. */
function markServiceRead(dateIso) {
  ACL.require('announcements', 'manage');
  var data = readTab_(TABS.items);
  var n = 0;
  data.rows.forEach(function (r) {
    if (isoDate_(r.service_date) === String(dateIso) && String(r.status) === 'Approved') {
      setCell_(TABS.items, r._row, 'status', 'Read');
      audit_(r.item_id, 'Approved', 'Read', 'Service delivered');
      n++;
    }
  });
  return { ok: true, count: n };
}

// ----------------------------- HOME PAGE -----------------------------

function homeState_(r) {
  var today = today_();
  var from = dateOnly_(r.home_from);
  var until = dateOnly_(r.home_until) || dateOnly_(r.expires_on);
  if (until && until < today) return 'past';
  if (from && from > today) return 'soon';
  if (!from) return 'soon';
  return 'live';
}

function homeRows_() {
  return readTab_(TABS.items).rows.filter(function (r) {
    return String(r.status) === 'Approved' || String(r.status) === 'Read';
  }).filter(function (r) {
    return isHomeChannel_(r.channel);
  });
}

function getHomeBoard() {
  ACL.require('announcements', 'manage');
  var rows = homeRows_().map(function (r) {
    return {
      id: String(r.item_id),
      title: String(r.title || ''),
      body: String(r.body || ''),
      by: String(r.submitted_name || r.submitted_by || ''),
      contact: String(r.contact || r.submitted_name || ''),
      pin: String(r.home_pin).toLowerCase() === 'yes',
      order: Number(r.home_order) || 999,
      from: isoDate_(r.home_from),
      until: isoDate_(r.home_until) || isoDate_(r.expires_on),
      alsoRead: String(r.channel || '').indexOf('Read aloud') > -1 ? String(r.service_label || '') : '',
      state: homeState_(r)
    };
  });
  rows.sort(function (a, b) {
    if (a.pin !== b.pin) return a.pin ? -1 : 1;
    return a.order - b.order;
  });
  return { rows: rows };
}

/** The public feed. The only announcements function a regular member can call. */
function getHomeFeed() {
  ACL.require('announcements', 'view_home');
  var rows = homeRows_().filter(function (r) { return homeState_(r) === 'live'; })
    .map(function (r) {
      return {
        title: String(r.title || ''),
        body: String(r.body || ''),
        contact: String(r.contact || r.submitted_name || ''),
        pin: String(r.home_pin).toLowerCase() === 'yes',
        order: Number(r.home_order) || 999
      };
    });
  rows.sort(function (a, b) {
    if (a.pin !== b.pin) return a.pin ? -1 : 1;
    return a.order - b.order;
  });
  return { rows: rows, updated: fmtDate_(new Date(), 'MMM d') };
}

function setHomePin(itemId, pinned) {
  ACL.require('announcements', 'manage');
  var item = findItem_(itemId);
  setCell_(TABS.items, item._row, 'home_pin', pinned ? 'yes' : 'no');
  return { ok: true };
}

function moveHomeItem(itemId, direction) {
  ACL.require('announcements', 'manage');
  var board = getHomeBoard().rows.filter(function (r) { return r.state === 'live'; });
  var pos = -1;
  board.forEach(function (r, i) { if (r.id === String(itemId)) pos = i; });
  if (pos === -1) return { ok: true };
  var other = board[direction === 'up' ? pos - 1 : pos + 1];
  if (!other) return { ok: true };

  // Renumber the whole live list so order is always dense and predictable.
  var swapped = board.slice();
  swapped[pos] = other;
  swapped[direction === 'up' ? pos - 1 : pos + 1] = board[pos];

  // Read the sheet ONCE and build an index. findItem_ per row would re-read the
  // whole tab for every item, which is O(n^2) calls against the Sheets service.
  var rowById = {};
  readTab_(TABS.items).rows.forEach(function (r) { rowById[String(r.item_id)] = r._row; });
  swapped.forEach(function (r, i) {
    if (rowById[r.id]) setCell_(TABS.items, rowById[r.id], 'home_order', i + 1);
  });
  return { ok: true };
}

function setHomeState(itemId, state) {
  ACL.require('announcements', 'manage');
  var item = findItem_(itemId);
  var today = today_();
  if (state === 'live') {
    setCell_(TABS.items, item._row, 'home_from', isoDate_(today));
    var until = dateOnly_(item.home_until);
    if (!until || until < today) {
      setCell_(TABS.items, item._row, 'home_until', isoDate_(new Date(today.getTime() + 7 * 86400000)));
    }
  } else if (state === 'past') {
    setCell_(TABS.items, item._row, 'home_until', isoDate_(new Date(today.getTime() - 86400000)));
  }
  audit_(itemId, '', 'home:' + state, 'Home page visibility changed');
  return { ok: true };
}

/** A post that lives on the home page and is never read from the podium. */
function addHomeOnlyPost(data) {
  ACL.require('announcements', 'manage');
  data = data || {};
  var title = String(data.title || '').trim();
  var body = String(data.body || '').trim();
  if (!title || !body) throw new Error('Title and text are both required.');

  var today = today_();
  var until = String(data.until || '').trim() || isoDate_(new Date(today.getTime() + 14 * 86400000));
  var id = newId_('ANN');

  appendRow_(TABS.items, {
    item_id: id,
    submitted_by: ACL.me(),
    submitted_name: ACL.displayName(ACL.me()),
    submitted_at: new Date(),
    service_date: '', service_label: 'Home page only',
    section: 'Announcements',
    title: title, body: body,
    channel: 'Home page',
    contact: String(data.contact || ACL.displayName(ACL.me())),
    expires_on: until,
    home_from: isoDate_(today), home_until: until,
    home_order: 1, home_pin: data.pin ? 'yes' : 'no',
    status: 'Approved',
    reviewer: ACL.me(), review_note: '',
    sort_order: 999, updated_at: new Date()
  });
  audit_(id, '', 'Approved', 'Home-page-only post created by ' + ACL.me());
  return { ok: true, id: id };
}

// ----------------------------- SERVICES -----------------------------

function addService(dateIso, type, label, reader) {
  ACL.require('announcements', 'manage');
  if (!dateIso) throw new Error('Pick a date.');
  var d = dateOnly_(dateIso);
  if (!d) throw new Error('That date is not valid.');
  var exists = readTab_(TABS.services).rows.some(function (r) { return isoDate_(r.service_date) === isoDate_(d); });
  if (exists) throw new Error('There is already a service on that date.');

  appendRow_(TABS.services, {
    service_date: d,
    service_type: String(type || 'sabbath').toLowerCase(),
    label: String(label || '').trim() || ({ sabbath: 'Sabbath Class', newmoon: 'New Moon', feast: 'Feast Day' }[type] || 'Service'),
    reader_name: String(reader || ''),
    active: 'yes'
  });
  return { ok: true };
}

function setServiceReader(dateIso, reader) {
  ACL.require('announcements', 'manage');
  var data = readTab_(TABS.services);
  for (var i = 0; i < data.rows.length; i++) {
    if (isoDate_(data.rows[i].service_date) === String(dateIso)) {
      setCell_(TABS.services, data.rows[i]._row, 'reader_name', String(reader || ''));
      return { ok: true };
    }
  }
  throw new Error('That service is not on the calendar.');
}
