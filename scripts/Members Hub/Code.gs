/**
 * True Nation — Web App server (Google Apps Script)
 *
 * Serves BOTH member pages from one deployment, gated to @truenation.org:
 *   • the Member Hub          →  <webapp-url>            (default)
 *   • the Commitment of Alms  →  <webapp-url>?page=alms
 *
 * The two designs are the Design Component HTML files, pasted into this
 * Apps Script project as HTML files named exactly:
 *      Hub    (from "True Nation Member Hub.dc.html")
 *      Alms   (from "True Nation Alms Commitment.dc.html")
 *
 * Those files load ./support.js and assets/*.png by RELATIVE path and link to
 * each other by filename — none of which resolve from a /exec URL. doGet()
 * rewrites them at serve time, so the .dc.html files themselves stay unchanged:
 *   ./support.js , assets/…   →  absolute URLs under ASSET_BASE  (hosted on Vercel)
 *   the .dc.html page links    →  ?page= links back into this web app
 *   {{ memberName }}           →  the signed-in member's first name
 *
 * The Alms page's Submit calls google.script.run.saveAlmsCommitment(payload),
 * which lives in AlmsCommitment.gs in this same project — no endpoint URL.
 *
 * ── SETUP ──────────────────────────────────────────────────────────────
 *   1. Upload support.js and the whole assets/ folder to the Vercel site so
 *      https://truenation.vercel.app/support.js and
 *      https://truenation.vercel.app/assets/tn_logo.png resolve. Set
 *      ASSET_BASE below to that origin (keep the trailing slash).
 *   2. File ▸ New ▸ HTML file → name it "Hub", paste the full contents of
 *      "True Nation Member Hub.dc.html". Repeat as "Alms" with the Alms file.
 *   3. Fill in the CONFIG in AlmsCommitment.gs (sheet id, folder id, headers).
 *   4. Deploy ▸ New deployment ▸ Web app — Execute as: Me,
 *      Who has access: True Nation (your Workspace domain). Re-deploy after edits.
 */

// Origin that hosts support.js and the assets/ folder (trailing slash required).
var ASSET_BASE = 'https://truenation.vercel.app/';

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page || 'hub').toLowerCase();
  var file = page === 'alms' ? 'Alms' : 'Hub';

  var html = HtmlService.createHtmlOutputFromFile(file).getContent();
  var self = ScriptApp.getService().getUrl();

  // 1. Relative asset + runtime paths → absolute (Vercel-hosted).
  html = html
    .replace(/(src|href)="\.\/support\.js"/g, '$1="' + ASSET_BASE + 'support.js"')
    .replace(/(src|href)="\.?\/?assets\//g,   '$1="' + ASSET_BASE + 'assets/');

  // 2. Page-to-page links (by filename) → this web app's ?page= routes.
  html = html
    .replace(/(href=")True Nation Alms Commitment\.dc\.html(")/g, '$1' + self + '?page=alms$2')
    .replace(/(href=")True Nation Member Hub\.dc\.html(")/g,      '$1' + self + '$2');

  // 3. Inject the signed-in member's name (read by the Hub's renderVals()).
  var nameJs = JSON.stringify(getMemberFirstName_());
  html = html.replace('</head>',
    '<script>window.TN_MEMBER_NAME=' + nameJs + ';</script></head>');

  return HtmlService.createHtmlOutput(html)
    .setTitle('True Nation')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** First name from the signed-in Workspace user; falls back to "Family". */
function getMemberFirstName_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) return 'Family';
  var local = email.split('@')[0].replace(/[._]+/g, ' ').trim();
  if (!local) return 'Family';
  return local.charAt(0).toUpperCase() + local.slice(1).split(' ')[0];
}
