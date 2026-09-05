/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRUE NATION INTRANET — My Quick Links (My Dashboard)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A per-user, editable shortcuts panel. Each staff member builds and edits
 * their OWN list of quick links. Nobody sees anyone else's links.
 *
 * Place on the My Dashboard page, directly BELOW the Quick Actions embed.
 *
 * STORAGE:
 *   Links are stored per-user in Apps Script UserProperties (key below).
 *   No sheet, no extra setup — the storage is private to each logged-in user
 *   and only readable by this script running as that user.
 *
 * SEEDING (first visit only):
 *   • Everyone starts with DEFAULT_LINKS.
 *   • Anyone listed in MEMBER_SEEDS also gets their personal extras
 *     (e.g. Shahad's hidden Teachers page).
 *   After the first save, the user's list is fully their own to edit.
 *
 * DEPLOYMENT (matches profile-editor.gs):
 *   Deploy → New deployment → Web app
 *     Execute as:      User accessing the web app
 *     Who has access:  Anyone in True Nation (truenation.org)
 *   Then embed the /exec URL on My Dashboard:
 *     Insert → Embed → By URL  (paste the web-app URL)
 *   To update later: Deploy → Manage deployments → Edit (pencil) →
 *     New version → Deploy.  The URL stays the same.
 *
 * NOTE: This is a standalone Apps Script web app, NOT a copy-paste HTML embed,
 *   so it is NOT added to reference/TNIC_All_Pages_Embeds.html. It lives here
 *   in scripts/ alongside profile-editor.gs.
 */

// ── CONFIGURATION ──────────────────────────────────────────────────────────
const QL_CONFIG = {
  // UserProperties key that holds this user's saved links (JSON array).
  STORE_KEY: 'tnic_my_quick_links',

  // Max links per user, and field limits (basic sanity guards).
  MAX_LINKS:  16,
  MAX_LABEL:  40,
  MAX_URL:    600,

  // Default links seeded for EVERY user on first visit.
  // [REPLACE] Confirm each URL matches your live Google Sites page slugs.
  DEFAULT_LINKS: [
    { icon: '👥', label: 'Staff Directory',   url: 'https://sites.google.com/truenation.org/portal/our-people' },
    { icon: '📅', label: 'Calendar & Events',  url: 'https://sites.google.com/truenation.org/portal/calendar-events' },
    { icon: '📚', label: 'Resources / Library', url: 'https://sites.google.com/truenation.org/portal/resources' },
    { icon: '🛠️', label: 'IT Help',            url: 'mailto:it@truenation.org' }
  ],

  // Personal extras seeded for specific people (keyed by their truenation.org email).
  // [REPLACE] Confirm Shahad's truenation.org address below (her domain login,
  //   not her personal gmail). The Teachers page requires a truenation.org session.
  MEMBER_SEEDS: {
    'shahad@truenation.org': [
      { icon: '🍎', label: 'Teachers Page',
        url: 'https://sites.google.com/truenation.org/portal/my-dashboard/teachers?authuser=0' }
    ]
  }
};


// ── WEB APP ENTRY ──────────────────────────────────────────────────────────
/**
 * NOT named doGet. Every .gs file in an Apps Script project shares one global
 * scope, so a second doGet() here silently overwrote the router in Code.gs and
 * took down the directory, Hub, Alms and profile setup - every page the
 * Operations web app serves. Reached via Code.gs as ?page=quicklinks.
 * Never define doGet outside Code.gs in this project.
 */
function ql_doGet_(e) {
  return HtmlService.createHtmlOutput(ql_buildHtml_())
    .setTitle('My Quick Links — True Nation')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// ── SERVER API (called from the page via google.script.run) ────────────────

/**
 * Returns the current user's links. On first visit (nothing stored yet),
 * seeds DEFAULT_LINKS + any MEMBER_SEEDS for this email and returns those.
 */
function ql_getLinks() {
  const props  = PropertiesService.getUserProperties();
  const stored = props.getProperty(QL_CONFIG.STORE_KEY);

  if (stored) {
    try { return ql_sanitizeList_(JSON.parse(stored)); }
    catch (err) { /* fall through to seed if corrupt */ }
  }

  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  let seed = QL_CONFIG.DEFAULT_LINKS.slice();
  if (QL_CONFIG.MEMBER_SEEDS[email]) {
    seed = seed.concat(QL_CONFIG.MEMBER_SEEDS[email]);
  }
  return ql_sanitizeList_(seed);
}

/**
 * Saves the user's full list (replaces prior list). Returns the cleaned list.
 * @param {Array<{icon:string,label:string,url:string}>} links
 */
function ql_saveLinks(links) {
  const clean = ql_sanitizeList_(links);
  PropertiesService.getUserProperties()
    .setProperty(QL_CONFIG.STORE_KEY, JSON.stringify(clean));
  return clean;
}


// ── VALIDATION HELPERS ─────────────────────────────────────────────────────

function ql_sanitizeList_(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (let i = 0; i < list.length && out.length < QL_CONFIG.MAX_LINKS; i++) {
    const item = ql_sanitizeItem_(list[i]);
    if (item) out.push(item);
  }
  return out;
}

function ql_sanitizeItem_(item) {
  if (!item || typeof item !== 'object') return null;
  const label = String(item.label || '').trim().slice(0, QL_CONFIG.MAX_LABEL);
  const rawUrl = String(item.url || '').trim().slice(0, QL_CONFIG.MAX_URL);
  let icon = String(item.icon || '').trim().slice(0, 4);
  if (!label || !rawUrl) return null;

  // Allow only safe schemes. Reject javascript:, data:, etc.
  const url = rawUrl.replace(/\s+/g, ' ');
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) return null;

  if (!icon) icon = '🔗';
  return { icon: icon, label: label, url: url };
}


// ── PAGE MARKUP ────────────────────────────────────────────────────────────
function ql_buildHtml_() {
  return [
'<!DOCTYPE html>',
'<html lang="en">',
'<head>',
'<meta charset="utf-8">',
'<meta name="viewport" content="width=device-width, initial-scale=1">',
'<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">',
'<style>',
'  :root{',
'    --wine:#7C1316; --gold:#C9972C; --snow:#FAF8F4; --cream:#F2EDE4;',
'    --bark:#3D2E28; --ink:#130D0A; --muted:#6B5F58;',
'  }',
'  *{box-sizing:border-box}',
'  html,body{margin:0;padding:0;background:transparent}',
'  body{font-family:"DM Sans",sans-serif;color:var(--ink)}',
'  .myql-wrap{background:var(--snow);border-radius:10px;padding:16px 16px 20px;width:100%}',
'  .myql-top{display:flex;align-items:center;justify-content:flex-end;margin-bottom:12px;gap:8px}',
'  .myql-btn{',
'    font-family:"Barlow Condensed",sans-serif;font-weight:600;font-size:13px;',
'    text-transform:uppercase;letter-spacing:.06em;cursor:pointer;',
'    border-radius:8px;padding:8px 14px;border:1px solid var(--cream);',
'    background:#fff;color:var(--wine);transition:background .15s,border-color .15s,box-shadow .15s;',
'  }',
'  .myql-btn:hover{border-color:var(--gold);box-shadow:0 2px 8px rgba(19,13,10,.10)}',
'  .myql-btn:focus-visible{outline:3px solid var(--gold);outline-offset:2px}',
'  .myql-btn-primary{background:var(--wine);color:var(--snow);border-color:var(--wine)}',
'  .myql-btn-primary:hover{background:#611013;border-color:#611013}',
'  .myql-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}',
'  .myql-tile{',
'    position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;',
'    gap:10px;background:#fff;border:1px solid var(--cream);border-radius:10px;',
'    padding:20px 12px 16px;text-decoration:none;color:var(--ink);',
'    box-shadow:0 2px 6px rgba(19,13,10,.06);',
'    transition:box-shadow .2s,transform .15s,border-color .2s;',
'  }',
'  a.myql-tile:hover{box-shadow:0 5px 16px rgba(19,13,10,.12);transform:translateY(-2px);border-color:var(--gold)}',
'  a.myql-tile:focus-visible{outline:3px solid var(--gold);outline-offset:2px}',
'  .myql-icon{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:23px;background:var(--cream)}',
'  .myql-label{',
'    font-family:"Barlow Condensed",sans-serif;font-weight:600;font-size:13px;',
'    text-transform:uppercase;letter-spacing:.05em;color:var(--bark);text-align:center;line-height:1.3;',
'    word-break:break-word;',
'  }',
'  .myql-remove{',
'    position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:50%;',
'    border:1px solid var(--cream);background:#fff;color:var(--wine);font-size:15px;line-height:1;',
'    cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;',
'  }',
'  .myql-remove:hover{background:var(--wine);color:var(--snow);border-color:var(--wine)}',
'  .myql-remove:focus-visible{outline:3px solid var(--gold);outline-offset:2px}',
'  .editing .myql-remove{display:flex}',
'  .editing .myql-tile{cursor:default}',
'  .myql-empty{color:var(--muted);font-size:14px;text-align:center;padding:20px 8px;line-height:1.5}',
'  /* Add form */',
'  .myql-form{background:#fff;border:1px solid var(--cream);border-radius:10px;padding:14px;margin-top:12px;display:none}',
'  .editing .myql-form{display:block}',
'  .myql-form-row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}',
'  .myql-field{display:flex;flex-direction:column;gap:4px}',
'  .myql-field label{font-size:12px;font-weight:700;color:var(--bark)}',
'  .myql-field input{',
'    font-family:"DM Sans",sans-serif;font-size:14px;padding:8px 10px;border:1px solid var(--cream);',
'    border-radius:7px;color:var(--ink);background:var(--snow);',
'  }',
'  .myql-field input:focus-visible{outline:3px solid var(--gold);outline-offset:1px;border-color:var(--gold)}',
'  .myql-f-icon input{width:64px;text-align:center}',
'  .myql-f-label input{width:150px}',
'  .myql-f-url{flex:1;min-width:200px}',
'  .myql-f-url input{width:100%}',
'  .myql-status{font-size:13px;color:var(--muted);margin-top:10px;min-height:18px}',
'  .myql-status.err{color:var(--wine);font-weight:700}',
'  @media (max-width:400px){.myql-grid{grid-template-columns:repeat(2,1fr)}}',
'</style>',
'</head>',
'<body>',
'  <div class="myql-wrap" id="myql-root">',
'    <div class="myql-top">',
'      <button type="button" class="myql-btn" id="myql-edit-toggle" aria-pressed="false">✏️ Edit</button>',
'    </div>',
'    <div class="myql-grid" id="myql-grid" role="list" aria-label="My quick links">',
'      <div class="myql-empty">Loading your links…</div>',
'    </div>',
'    <form class="myql-form" id="myql-form" aria-label="Add a quick link">',
'      <div class="myql-form-row">',
'        <div class="myql-field myql-f-icon"><label for="myql-in-icon">Icon</label><input id="myql-in-icon" type="text" maxlength="4" placeholder="🔗" aria-label="Icon (emoji)"></div>',
'        <div class="myql-field myql-f-label"><label for="myql-in-label">Label</label><input id="myql-in-label" type="text" maxlength="40" placeholder="e.g. Payroll" required></div>',
'        <div class="myql-field myql-f-url"><label for="myql-in-url">Link URL</label><input id="myql-in-url" type="url" maxlength="600" placeholder="https://…" required></div>',
'        <button type="submit" class="myql-btn myql-btn-primary">＋ Add</button>',
'      </div>',
'      <div class="myql-status" id="myql-status" role="status" aria-live="polite"></div>',
'    </form>',
'  </div>',
'',
'<script>',
'  var links = [];',
'  var editing = false;',
'',
'  function esc(s){return String(s).replace(/[&<>"\\x27]/g,function(c){',
'    return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\\x27":"&#x27;"}[c];});}',
'',
'  function render(){',
'    var grid = document.getElementById("myql-grid");',
'    document.getElementById("myql-root").classList.toggle("editing", editing);',
'    if(!links.length){',
'      grid.innerHTML = editing',
'        ? \'<div class="myql-empty">No links yet. Add one below.</div>\'',
'        : \'<div class="myql-empty">No links yet. Click <strong>Edit</strong> to add your first shortcut.</div>\';',
'      return;',
'    }',
'    var html = "";',
'    for(var i=0;i<links.length;i++){',
'      var L = links[i];',
'      if(editing){',
'        html += \'<div class="myql-tile" role="listitem">\' +',
'          \'<button type="button" class="myql-remove" aria-label="Remove \' + esc(L.label) + \'" data-i="\' + i + \'">×</button>\' +',
'          \'<span class="myql-icon" aria-hidden="true">\' + esc(L.icon) + \'</span>\' +',
'          \'<span class="myql-label">\' + esc(L.label) + \'</span></div>\';',
'      } else {',
'        var tgt = /^mailto:|^tel:/i.test(L.url) ? "" : \' target="_blank" rel="noopener"\';',
'        html += \'<a class="myql-tile" role="listitem" href="\' + esc(L.url) + \'"\' + tgt + \'>\' +',
'          \'<span class="myql-icon" aria-hidden="true">\' + esc(L.icon) + \'</span>\' +',
'          \'<span class="myql-label">\' + esc(L.label) + \'</span></a>\';',
'      }',
'    }',
'    grid.innerHTML = html;',
'    var rm = grid.querySelectorAll(".myql-remove");',
'    for(var j=0;j<rm.length;j++){ rm[j].addEventListener("click", onRemove); }',
'  }',
'',
'  function onRemove(ev){',
'    var i = parseInt(ev.currentTarget.getAttribute("data-i"),10);',
'    links.splice(i,1);',
'    render();',
'    persist();',
'  }',
'',
'  function setStatus(msg, isErr){',
'    var s = document.getElementById("myql-status");',
'    s.textContent = msg || "";',
'    s.className = "myql-status" + (isErr ? " err" : "");',
'  }',
'',
'  function persist(){',
'    setStatus("Saving…", false);',
'    google.script.run',
'      .withSuccessHandler(function(saved){ links = saved || []; setStatus("Saved.", false); render(); })',
'      .withFailureHandler(function(err){ setStatus("Could not save: " + err.message, true); })',
'      .ql_saveLinks(links);',
'  }',
'',
'  document.getElementById("myql-edit-toggle").addEventListener("click", function(){',
'    editing = !editing;',
'    this.setAttribute("aria-pressed", editing ? "true" : "false");',
'    this.innerHTML = editing ? "✓ Done" : "✏️ Edit";',
'    setStatus("", false);',
'    render();',
'  });',
'',
'  document.getElementById("myql-form").addEventListener("submit", function(ev){',
'    ev.preventDefault();',
'    var icon  = document.getElementById("myql-in-icon").value.trim() || "🔗";',
'    var label = document.getElementById("myql-in-label").value.trim();',
'    var url   = document.getElementById("myql-in-url").value.trim();',
'    if(!label || !url){ setStatus("Label and URL are both required.", true); return; }',
'    if(!/^(https?:\\/\\/|mailto:|tel:)/i.test(url)){',
'      setStatus("URL must start with https://, mailto:, or tel:", true); return;',
'    }',
'    if(links.length >= 16){ setStatus("You have reached the 16-link maximum.", true); return; }',
'    links.push({icon:icon, label:label, url:url});',
'    document.getElementById("myql-in-icon").value = "";',
'    document.getElementById("myql-in-label").value = "";',
'    document.getElementById("myql-in-url").value = "";',
'    document.getElementById("myql-in-label").focus();',
'    render();',
'    persist();',
'  });',
'',
'  google.script.run',
'    .withSuccessHandler(function(data){ links = data || []; render(); })',
'    .withFailureHandler(function(err){',
'      document.getElementById("myql-grid").innerHTML =',
'        \'<div class="myql-empty">Could not load links: \' + esc(err.message) + \'</div>\';',
'    })',
'    .ql_getLinks();',
'</script>',
'</body>',
'</html>'
  ].join('\n');
}
