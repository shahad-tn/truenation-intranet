/**
 * TNIC ACCESS CONTROL — reusable permission layer for the whole intranet
 * ===========================================================================
 * Drop this file into ANY TNIC Apps Script project. It gives you group-based
 * permissions per module and capability, editable from a Sheet tab or the
 * built-in Access admin page (access.html) — no code changes to add or remove
 * someone's access.
 *
 * THE MODEL
 *   module      a page or feature area          e.g. "announcements", "directory"
 *   capability  something a person can DO       e.g. "submit", "manage", "read_script"
 *   groups      who can do it                   e.g. "tn-admin@truenation.org, it@truenation.org"
 *
 * One row per module+capability in the `access_control` sheet tab. To change who
 * can manage announcements, edit that row's group list — in the Sheet or in the
 * Access page. Membership itself stays in Google Groups, where it belongs.
 *
 * SPECIAL TOKENS (use instead of a group address)
 *   @domain   anyone with a signed-in @truenation.org account
 *   @none     nobody (used to switch a capability off without deleting the rule)
 *
 * USAGE
 *   ACL.can('announcements', 'manage')            -> true/false
 *   ACL.require('announcements', 'manage')        -> throws if not allowed
 *   ACL.capabilities('announcements')             -> {submit:true, manage:false, ...}
 *   ACL.context()                                 -> {email, name, isSuperAdmin, groups}
 *
 * DEPLOY REQUIREMENT
 *   The web app must "Execute as: Me" (an account with Admin Directory read
 *   access) and "Who has access: Anyone at truenation.org". That combination is
 *   what lets Session.getActiveUser() identify the visitor while AdminDirectory
 *   resolves their group membership.
 *
 * ENABLE: Services -> Admin SDK API (identifier AdminDirectory)
 * ===========================================================================
 */

var ACL = (function () {

  // ---- Config -----------------------------------------------------------
  var CFG = {
    // The spreadsheet that holds the access_control tab.
    // Leave blank to use the container-bound spreadsheet.
    spreadsheetId: '',
    tabName: 'access_control',
    domain: 'truenation.org',

    // Groups that can do anything, anywhere, including editing the rules
    // themselves. Deliberately hardcoded — this is the lock on the lock.
    superAdminGroups: ['tn-admin@truenation.org', 'it@truenation.org'],

    // Where to send access-denied help requests.
    contactEmail: 'it@truenation.org',

    userCacheSeconds: 600,   // group membership per user
    rulesCacheSeconds: 300   // the rules table
  };

  // ---- Default rules ----------------------------------------------------
  // Written into the sheet on first run. After that the SHEET wins — edits
  // there are never overwritten by this list.
  var DEFAULTS = [
    ['announcements', 'submit',      '@domain',
      'Submit an announcement for review.'],
    ['announcements', 'manage',      'tn-admin@truenation.org, clerical@truenation.org, thycommittee@truenation.org, it@truenation.org',
      'Approve, deny, edit and order announcements. Edit standing text.'],
    ['announcements', 'read_script', 'tn-admin@truenation.org, clerical@truenation.org, thycommittee@truenation.org, it@truenation.org',
      'Open the reader script for a service.'],
    ['announcements', 'view_home',   '@domain',
      'See the announcements feed on the intranet home page.'],

    ['directory',     'view',        '@domain',
      'View the staff directory.'],
    ['directory',     'manage',      'tn-admin@truenation.org, clerical@truenation.org, it@truenation.org',
      'Edit member records, branch, employment type, notes.'],

    ['core',          'access_admin','tn-admin@truenation.org, it@truenation.org',
      'Edit these access rules. Keep this list short.']
  ];

  // ---- Identity ---------------------------------------------------------

  function me() {
    try { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
    catch (err) { return ''; }
  }

  function displayName(email) {
    email = email || me();
    if (!email) return 'Guest';
    try {
      var u = AdminDirectory.Users.get(email);
      if (u && u.name && u.name.fullName) return u.name.fullName;
    } catch (err) { /* fall through */ }
    var local = email.split('@')[0].replace(/[._-]+/g, ' ');
    return local.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function inDomain(email) {
    email = email || me();
    return !!email && email.split('@')[1] === CFG.domain;
  }

  // ---- Group membership -------------------------------------------------

  function inGroup(group, email) {
    email = (email || me()).toLowerCase();
    group = (group || '').toLowerCase().trim();
    if (!email || !group) return false;

    if (group === '@domain') return inDomain(email);
    if (group === '@none')   return false;

    var cache = CacheService.getUserCache();
    var key = 'acl_' + Utilities.base64EncodeWebSafe(group + '|' + email);
    var hit = cache.get(key);
    if (hit !== null) return hit === '1';

    var result = false;
    try {
      AdminDirectory.Members.get(group, email);   // throws when not a member
      result = true;
    } catch (err) {
      try { result = GroupsApp.getGroupByEmail(group).hasUser(email); }
      catch (e2) { result = false; }
    }
    try { cache.put(key, result ? '1' : '0', CFG.userCacheSeconds); } catch (e3) {}
    return result;
  }

  function inAnyGroup(groups, email) {
    for (var i = 0; i < groups.length; i++) {
      if (inGroup(groups[i], email)) return true;
    }
    return false;
  }

  function isSuperAdmin(email) {
    return inAnyGroup(CFG.superAdminGroups, email || me());
  }

  // ---- Rules table ------------------------------------------------------

  function _book() {
    return CFG.spreadsheetId
      ? SpreadsheetApp.openById(CFG.spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();
  }

  function ensureSheet() {
    var ss = _book();
    var sh = ss.getSheetByName(CFG.tabName);
    if (!sh) {
      sh = ss.insertSheet(CFG.tabName);
      sh.appendRow(['module', 'capability', 'groups', 'description', 'updated_by', 'updated_at']);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, 6).setFontWeight('bold');
      sh.setColumnWidth(3, 420);
      sh.setColumnWidth(4, 320);
    }
    // Add any default rule that is missing. Never touch one that exists.
    var have = {};
    var rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      have[String(rows[i][0]).trim() + '|' + String(rows[i][1]).trim()] = true;
    }
    var add = [];
    DEFAULTS.forEach(function (d) {
      if (!have[d[0] + '|' + d[1]]) add.push([d[0], d[1], d[2], d[3], 'system', new Date()]);
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 6).setValues(add);
    return sh;
  }

  function _rules() {
    var cache = CacheService.getScriptCache();
    var hit = cache.get('acl_rules');
    if (hit) { try { return JSON.parse(hit); } catch (e) {} }

    var sh = ensureSheet();
    var rows = sh.getDataRange().getValues();
    var map = {};
    for (var i = 1; i < rows.length; i++) {
      var mod = String(rows[i][0] || '').trim().toLowerCase();
      var cap = String(rows[i][1] || '').trim().toLowerCase();
      if (!mod || !cap) continue;
      var groups = String(rows[i][2] || '')
        .split(/[,;\n]/).map(function (g) { return g.trim().toLowerCase(); })
        .filter(function (g) { return !!g; });
      map[mod + '|' + cap] = { groups: groups, description: String(rows[i][3] || '') };
    }
    try { cache.put('acl_rules', JSON.stringify(map), CFG.rulesCacheSeconds); } catch (e) {}
    return map;
  }

  function invalidate() {
    try { CacheService.getScriptCache().remove('acl_rules'); } catch (e) {}
  }

  // ---- The questions everything else asks --------------------------------

  function can(module, capability, email) {
    email = email || me();
    if (!email) return false;
    if (isSuperAdmin(email)) return true;                 // super admins bypass
    var rule = _rules()[String(module).toLowerCase() + '|' + String(capability).toLowerCase()];
    if (!rule) return false;                              // unknown = denied, on purpose
    return inAnyGroup(rule.groups, email);
  }

  function require(module, capability) {
    if (!can(module, capability)) {
      throw new Error('You do not have permission to do that. Contact ' + CFG.contactEmail + ' if you think this is a mistake.');
    }
    return true;
  }

  function capabilities(module, email) {
    email = email || me();
    var out = {};
    var rules = _rules();
    var prefix = String(module).toLowerCase() + '|';
    Object.keys(rules).forEach(function (k) {
      if (k.indexOf(prefix) === 0) out[k.split('|')[1]] = can(module, k.split('|')[1], email);
    });
    return out;
  }

  function context(module) {
    var email = me();
    return {
      email: email,
      name: displayName(email),
      inDomain: inDomain(email),
      isSuperAdmin: isSuperAdmin(email),
      can: module ? capabilities(module, email) : {},
      contactEmail: CFG.contactEmail
    };
  }

  // ---- Admin: read and edit the matrix ------------------------------------

  function getMatrix() {
    require('core', 'access_admin');
    var sh = ensureSheet();
    var rows = sh.getDataRange().getValues();
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      out.push({
        row: i + 1,
        module: String(rows[i][0]),
        capability: String(rows[i][1]),
        groups: String(rows[i][2] || ''),
        description: String(rows[i][3] || ''),
        updatedBy: String(rows[i][4] || ''),
        updatedAt: rows[i][5] ? Utilities.formatDate(new Date(rows[i][5]), Session.getScriptTimeZone(), 'MMM d, yyyy') : ''
      });
    }
    out.sort(function (a, b) {
      return a.module === b.module
        ? a.capability.localeCompare(b.capability)
        : a.module.localeCompare(b.module);
    });
    return { rules: out, superAdminGroups: CFG.superAdminGroups, domain: CFG.domain };
  }

  function setRule(module, capability, groups) {
    require('core', 'access_admin');
    var sh = ensureSheet();
    var rows = sh.getDataRange().getValues();
    var clean = String(groups || '').split(/[,;\n]/)
      .map(function (g) { return g.trim().toLowerCase(); })
      .filter(function (g) { return !!g; });

    // Guard: never let someone lock everyone out of the access page.
    if (String(module).toLowerCase() === 'core' && String(capability).toLowerCase() === 'access_admin' && !clean.length) {
      throw new Error('The access admin rule cannot be emptied. Add at least one group.');
    }

    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim().toLowerCase() === String(module).toLowerCase() &&
          String(rows[i][1]).trim().toLowerCase() === String(capability).toLowerCase()) {
        sh.getRange(i + 1, 3).setValue(clean.join(', '));
        sh.getRange(i + 1, 5).setValue(me());
        sh.getRange(i + 1, 6).setValue(new Date());
        invalidate();
        return { ok: true, groups: clean.join(', ') };
      }
    }
    throw new Error('No such rule: ' + module + ' / ' + capability);
  }

  function addRule(module, capability, groups, description) {
    require('core', 'access_admin');
    var sh = ensureSheet();
    var mod = String(module).trim().toLowerCase();
    var cap = String(capability).trim().toLowerCase().replace(/\s+/g, '_');
    if (!mod || !cap) throw new Error('Module and capability are both required.');
    if (_rules()[mod + '|' + cap]) throw new Error('That rule already exists.');
    sh.appendRow([mod, cap, String(groups || '@none'), String(description || ''), me(), new Date()]);
    invalidate();
    return { ok: true };
  }

  /** Answers "what can this person actually do?" — for troubleshooting. */
  function explain(email) {
    require('core', 'access_admin');
    email = String(email || '').toLowerCase().trim();
    if (!email) throw new Error('Enter an email address.');
    var rules = _rules();
    var out = [];
    Object.keys(rules).sort().forEach(function (k) {
      var parts = k.split('|');
      out.push({
        module: parts[0],
        capability: parts[1],
        allowed: can(parts[0], parts[1], email),
        via: rules[k].groups.filter(function (g) { return inGroup(g, email); })
      });
    });
    return { email: email, isSuperAdmin: isSuperAdmin(email), results: out };
  }

  return {
    me: me, displayName: displayName, inDomain: inDomain,
    inGroup: inGroup, isSuperAdmin: isSuperAdmin,
    can: can, require: require, capabilities: capabilities, context: context,
    ensureSheet: ensureSheet, invalidate: invalidate,
    getMatrix: getMatrix, setRule: setRule, addRule: addRule, explain: explain,
    CFG: CFG
  };
})();

/* Client-callable wrappers (google.script.run cannot reach object methods). */
function acl_getMatrix()                          { return ACL.getMatrix(); }
function acl_setRule(m, c, g)                     { return ACL.setRule(m, c, g); }
function acl_addRule(m, c, g, d)                  { return ACL.addRule(m, c, g, d); }
function acl_explain(email)                       { return ACL.explain(email); }
function acl_setup()                              { ACL.require('core','access_admin'); ACL.ensureSheet(); return 'access_control tab ready.'; }
