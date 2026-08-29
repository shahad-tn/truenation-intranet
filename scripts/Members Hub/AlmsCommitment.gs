/**
 * True Nation — Alms Commitment  (Google Apps Script Web App)
 *
 * Runs in the same Workspace project as the Member Hub / Profile Setup pages,
 * served at portal.truenation.org and gated to @truenation.org logins.
 *
 * saveAlmsCommitment() is called directly from the page via
 *   google.script.run.saveAlmsCommitment(payload)
 * so there is NO endpoint URL and NO CORS. The signed-in member's email is
 * read server-side from the session — it cannot be spoofed by the client.
 *
 * The commitment is written onto the member's OWN row in the shared profiles
 * Sheet (the same sheet the Profile Setup pages write to), matched by email.
 * The signature PNG is saved to Drive and linked from the row.
 *
 * SETUP
 *   1. Paste the profiles Sheet ID and the tab name below (must match the
 *      sheet the Profile Setup pages already use).
 *   2. Paste a Drive folder ID for the signature images.
 *   3. Confirm EMAIL_HEADER matches the header of the email column in that
 *      sheet (the column used to identify each member).
 *   4. Deploy / re-deploy as a Web App (Execute as: Me, Access: anyone within
 *      True Nation) — same deployment that serves the pages.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────
var SHEET_ID     = "PASTE_PROFILES_SHEET_ID";      // same sheet as Profile Setup
var TAB_NAME     = "Profiles";                     // the profiles tab
var FOLDER_ID    = "PASTE_SIGNATURE_FOLDER_ID";    // Drive folder for signatures
var EMAIL_HEADER = "Email";                        // header of the member-email column

// Headers written onto the member's row (created if they don't exist yet).
var COL_COMMITTED = "Alms Committed";
var COL_DATE      = "Alms Commitment Date";
var COL_SIGNATURE = "Alms Signature";
var COL_SIGNED_AT = "Alms Signed At";
var COL_NAME_SEEN = "Alms Signed Name";            // name as typed on the form
// ────────────────────────────────────────────────────────────────────────

/**
 * Called from the Alms Commitment page. `payload` = { name, date, agreed,
 * signature (PNG data URL), source, submittedAt }. Returns a plain object
 * to the page's success handler.
 */
function saveAlmsCommitment(payload) {
  var email = Session.getActiveUser().getEmail();
  if (!email) throw new Error("No signed-in user; cannot record commitment.");
  if (!payload || !payload.agreed) throw new Error("Commitment was not affirmed.");

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(TAB_NAME);
  if (!sheet) throw new Error('Tab "' + TAB_NAME + '" not found.');

  // Read headers, ensure the alms columns exist.
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  headers = ensureColumns_(sheet, headers,
    [COL_COMMITTED, COL_DATE, COL_SIGNATURE, COL_SIGNED_AT, COL_NAME_SEEN]);

  var emailIdx = headers.indexOf(EMAIL_HEADER);
  if (emailIdx === -1) throw new Error('Email column "' + EMAIL_HEADER + '" not found.');

  // Find the member's row by email (case-insensitive).
  var rowIndex = findRowByEmail_(sheet, emailIdx, email);
  if (rowIndex === -1) {
    // No profile row yet — create one so nothing is lost.
    rowIndex = sheet.getLastRow() + 1;
    sheet.getRange(rowIndex, emailIdx + 1).setValue(email);
  }

  // Save the signature image and get a shareable link.
  var sigUrl = saveSignature_(payload.signature, payload.name || email);

  // Write the alms fields onto that row.
  setCell_(sheet, rowIndex, headers, COL_COMMITTED, "Yes");
  setCell_(sheet, rowIndex, headers, COL_DATE,      payload.date || "");
  setCell_(sheet, rowIndex, headers, COL_SIGNATURE, sigUrl);
  setCell_(sheet, rowIndex, headers, COL_SIGNED_AT, payload.submittedAt || new Date().toISOString());
  setCell_(sheet, rowIndex, headers, COL_NAME_SEEN, payload.name || "");

  return { ok: true, email: email, row: rowIndex };
}

// ── helpers ───────────────────────────────────────────────────────────────

function ensureColumns_(sheet, headers, needed) {
  needed.forEach(function (name) {
    if (headers.indexOf(name) === -1) {
      headers.push(name);
      sheet.getRange(1, headers.length).setValue(name);
    }
  });
  return headers;
}

function findRowByEmail_(sheet, emailIdx, email) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var col = sheet.getRange(2, emailIdx + 1, last - 1, 1).getValues();
  var target = String(email).trim().toLowerCase();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim().toLowerCase() === target) return i + 2; // 1-based, +header
  }
  return -1;
}

function setCell_(sheet, row, headers, header, value) {
  var idx = headers.indexOf(header);
  if (idx === -1) return;
  sheet.getRange(row, idx + 1).setValue(value);
}

function saveSignature_(dataUrl, name) {
  if (!dataUrl || dataUrl.indexOf("base64,") === -1) return "";
  var bytes = Utilities.base64Decode(dataUrl.split("base64,")[1]);
  var safe = String(name).replace(/[^\w\- ]/g, "").trim() || "member";
  var blob = Utilities.newBlob(bytes, "image/png",
    "Alms Signature - " + safe + " - " + new Date().toISOString() + ".png");
  return DriveApp.getFolderById(FOLDER_ID).createFile(blob).getUrl();
}
