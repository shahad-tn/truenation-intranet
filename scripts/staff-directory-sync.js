/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRUE NATION INTRANET — Staff Directory Sync Script (v2)
 * Target sheet: "True Nation Staff Data" (existing)
 * Target tab:   "data"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHY V2:
 * You already have a rich 54-column roster at this URL:
 *   https://docs.google.com/spreadsheets/d/1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk/
 * This version of the script works WITH that existing sheet instead of
 * creating a parallel one. Your existing userdirectory.html app keeps working
 * untouched — we just add 6 columns to the right and let Workspace sync the
 * email/name fields when they are blank.
 *
 * WHAT THIS SCRIPT DOES:
 *   1. Looks up the "data" tab header row by NAME (not column letter), so
 *      column reorderings won't break it.
 *   2. Ensures 6 columns exist: department, title_role, sub_groups,
 *      display_name, sync_source, last_synced. Adds them if missing.
 *   3. For each active Google Workspace user:
 *        - If email is NOT in 'data' tab → add a new row with email filled in
 *          and legal_first / legal_last / phone filled from Workspace.
 *        - If email IS in 'data' tab → fill legal_first, legal_last, phone
 *          ONLY IF those cells are currently blank. Existing hand-entered
 *          values are preserved.
 *        - Always stamp sync_source = "Apps Script" and last_synced = now.
 *   4. flagInactiveUsers() cross-references 'data' vs 'Former Staff' and
 *      Workspace, and reports anyone who is on 'data' but no longer in
 *      Workspace (suggesting they should be moved to Former Staff).
 *
 * SETUP:
 *   1. Open the Staff Data Google Sheet → Extensions → Apps Script
 *   2. Paste this entire file into the Apps Script editor
 *   3. Click "+" next to Services → add "Admin SDK API" (adminDirectoryV1) → Add
 *   4. In Google Cloud Console: APIs & Services → Enable API → "Admin SDK API"
 *   5. Run ensureSyncColumns() ONCE to add the 6 new columns at the end
 *   6. Run syncWorkspaceUsers() once manually (click Run → approve permissions)
 *   7. Set up a daily trigger: Triggers (clock icon) → Add Trigger →
 *        Function: syncWorkspaceUsers
 *        Event source: Time-driven → Day timer → 2am–3am
 *
 * IMPORTANT NOTES:
 *   - You must be a Google Workspace admin (or delegated admin).
 *   - The script reads Workspace users and writes only to the 'data' tab.
 *   - It will NEVER overwrite: branch, location, department, title_role,
 *     sub_groups, display_name, or any of the 50+ existing columns with
 *     non-blank values. Safe to run on production data.
 *   - Multi-campus members (e.g., Bishop Yahzeqel → Detroit + Macon):
 *     add the second row manually. The script matches on email and will
 *     not create a duplicate row — so both rows survive and both show up
 *     in the dashboard for that user.
 *
 * HEADERS THIS SCRIPT TOUCHES (header-name based, case-sensitive):
 *     'email'          (key, never overwritten)
 *     'legal_first'    (filled if blank)
 *     'legal_last'     (filled if blank)
 *     'phone'          (filled if blank)
 *     'sync_source'    (always set to 'Apps Script')
 *     'last_synced'    (always set to now())
 *   Plus these 4 are ADDED by ensureSyncColumns() but not auto-filled:
 *     'department', 'title_role', 'sub_groups', 'display_name'
 */

// ─── CONFIGURATION ───
const CONFIG = {
  DATA_TAB: "data",
  FORMER_TAB: "Former Staff",
  // Headers the sync touches (must match exactly)
  COL_EMAIL: "email",
  COL_LEGAL_FIRST: "legal_first",
  COL_LEGAL_LAST: "legal_last",
  COL_PHONE: "phone",
  // New columns to ensure exist
  NEW_COLUMNS: [
    "department",
    "title_role",
    "sub_groups",
    "display_name",
    "sync_source",
    "last_synced",
  ],
  COL_SYNC_SOURCE: "sync_source",
  COL_LAST_SYNCED: "last_synced",
};


/**
 * One-time setup: ensures the 6 new columns exist at the end of the header row.
 * Safe to re-run; skips any column that is already present.
 */
function ensureSyncColumns() {
  const sheet = _getDataSheet_();
  const headers = _getHeaders_(sheet);
  let nextCol = headers.length + 1;
  let added = [];

  for (const name of CONFIG.NEW_COLUMNS) {
    if (!headers.includes(name)) {
      sheet.getRange(1, nextCol).setValue(name);
      headers.push(name);
      added.push(name);
      nextCol++;
    }
  }

  const msg = added.length
    ? `Added ${added.length} column(s): ${added.join(", ")}`
    : "All sync columns already present. Nothing to add.";
  Logger.log(msg);
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, "TNIC Sync Setup", 8);
}


/**
 * Main sync function — call manually or via daily trigger.
 * Adds rows for new Workspace users; fills blank names/phone for existing rows;
 * never overwrites any hand-entered data.
 */
function syncWorkspaceUsers() {
  const sheet = _getDataSheet_();
  const headers = _getHeaders_(sheet);
  const H = _headerMap_(headers);

  // Verify required columns exist
  _requireHeader_(H, CONFIG.COL_EMAIL);
  // Optional but auto-created by ensureSyncColumns():
  const hasSyncSource = H[CONFIG.COL_SYNC_SOURCE] != null;
  const hasLastSynced = H[CONFIG.COL_LAST_SYNCED] != null;
  if (!hasSyncSource || !hasLastSynced) {
    throw new Error(
      "Missing 'sync_source' and/or 'last_synced' columns. " +
      "Run ensureSyncColumns() first."
    );
  }

  // ─── 1. Load existing emails → row number ───
  const lastRow = sheet.getLastRow();
  const emailColIdx = H[CONFIG.COL_EMAIL];  // 1-based column index
  const existingEmails = {};

  if (lastRow > 1) {
    const range = sheet.getRange(2, emailColIdx, lastRow - 1, 1).getValues();
    for (let i = 0; i < range.length; i++) {
      const email = String(range[i][0] || "").toLowerCase().trim();
      if (email) existingEmails[email] = i + 2;  // 1-based row number
    }
  }

  // ─── 2. Fetch Workspace users ───
  const wsUsers = _getAllWorkspaceUsers_();
  const now = new Date();
  let newCount = 0, filledCount = 0, metaOnlyCount = 0;

  // ─── 3. Process each Workspace user ───
  for (const user of wsUsers) {
    const email = (user.primaryEmail || "").toLowerCase().trim();
    if (!email) continue;

    const firstName = (user.name && user.name.givenName) || "";
    const lastName = (user.name && user.name.familyName) || "";
    const phone = (user.phones && user.phones[0] && user.phones[0].value) || "";

    if (existingEmails[email]) {
      // ───────── EXISTING ROW: fill blanks only ─────────
      const row = existingEmails[email];
      let filledAnything = false;

      filledAnything = _fillIfBlank_(sheet, row, H[CONFIG.COL_LEGAL_FIRST], firstName) || filledAnything;
      filledAnything = _fillIfBlank_(sheet, row, H[CONFIG.COL_LEGAL_LAST], lastName)  || filledAnything;
      filledAnything = _fillIfBlank_(sheet, row, H[CONFIG.COL_PHONE], phone)          || filledAnything;

      // Always stamp sync metadata
      sheet.getRange(row, H[CONFIG.COL_SYNC_SOURCE]).setValue("Apps Script");
      sheet.getRange(row, H[CONFIG.COL_LAST_SYNCED]).setValue(now);

      if (filledAnything) filledCount++;
      else metaOnlyCount++;

    } else {
      // ───────── NEW ROW: create ─────────
      const newRow = sheet.getLastRow() + 1;
      const rowData = new Array(headers.length).fill("");

      rowData[H[CONFIG.COL_EMAIL] - 1] = email;
      if (H[CONFIG.COL_LEGAL_FIRST]) rowData[H[CONFIG.COL_LEGAL_FIRST] - 1] = firstName;
      if (H[CONFIG.COL_LEGAL_LAST])  rowData[H[CONFIG.COL_LEGAL_LAST] - 1]  = lastName;
      if (H[CONFIG.COL_PHONE])       rowData[H[CONFIG.COL_PHONE] - 1]       = phone;
      rowData[H[CONFIG.COL_SYNC_SOURCE] - 1] = "Apps Script";
      rowData[H[CONFIG.COL_LAST_SYNCED] - 1] = now;

      sheet.getRange(newRow, 1, 1, headers.length).setValues([rowData]);
      existingEmails[email] = newRow;
      newCount++;
    }
  }

  const msg = `Sync complete: ${wsUsers.length} Workspace users processed. ` +
              `${newCount} new rows, ${filledCount} rows had blanks filled, ` +
              `${metaOnlyCount} rows timestamped only.`;
  Logger.log(msg);
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Staff Directory Sync", 10);
}


/**
 * Reports emails that are in 'data' but NOT in Google Workspace anymore.
 * Suggests moving them to 'Former Staff'. Does NOT automatically move rows.
 * Run manually as needed (e.g., after a resignation).
 */
function flagInactiveUsers() {
  const sheet = _getDataSheet_();
  const headers = _getHeaders_(sheet);
  const H = _headerMap_(headers);
  const emailColIdx = H[CONFIG.COL_EMAIL];

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getActiveSpreadsheet().toast("No data rows.", "Flag Inactive", 5);
    return;
  }

  const wsUsers = _getAllWorkspaceUsers_();
  const wsEmails = new Set(wsUsers.map(u => (u.primaryEmail || "").toLowerCase().trim()));

  const range = sheet.getRange(2, emailColIdx, lastRow - 1, 1).getValues();
  const stranded = [];
  for (let i = 0; i < range.length; i++) {
    const email = String(range[i][0] || "").toLowerCase().trim();
    if (email && !wsEmails.has(email)) {
      stranded.push({ row: i + 2, email });
    }
  }

  if (!stranded.length) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "All emails in 'data' match active Workspace users.",
      "Flag Inactive", 8
    );
    return;
  }

  // Build a report log — surface rows/emails, don't auto-move
  Logger.log(`Found ${stranded.length} email(s) in 'data' with no active Workspace user:`);
  stranded.forEach(s => Logger.log(`  Row ${s.row} — ${s.email}`));
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Found ${stranded.length} stranded email(s). Open View → Logs for the list, ` +
    `then move rows to 'Former Staff' as needed.`,
    "Flag Inactive", 15
  );
}


/**
 * Custom menu for the sheet.
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("TNIC Directory")
    .addItem("Ensure Sync Columns (one-time)", "ensureSyncColumns")
    .addItem("Sync Workspace Users", "syncWorkspaceUsers")
    .addItem("Flag Inactive Users (report)", "flagInactiveUsers")
    .addToUi();
}


// ───────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ───────────────────────────────────────────────────────────────

function _getDataSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.DATA_TAB);
  if (!sheet) throw new Error(`Tab "${CONFIG.DATA_TAB}" not found.`);
  return sheet;
}

function _getHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
}

function _headerMap_(headers) {
  // Returns { 'email': 1, 'legal_first': 7, ... } — 1-based indices
  const map = {};
  headers.forEach((h, i) => { if (h) map[h] = i + 1; });
  return map;
}

function _requireHeader_(H, name) {
  if (!H[name]) throw new Error(`Required header "${name}" not found in the 'data' tab.`);
}

function _fillIfBlank_(sheet, row, colIdx, value) {
  if (!colIdx || !value) return false;
  const cell = sheet.getRange(row, colIdx);
  const current = cell.getValue();
  if (current === "" || current === null || current === undefined) {
    cell.setValue(value);
    return true;
  }
  return false;
}

/**
 * Fetch all active (non-suspended, non-archived) users from Google Workspace.
 * Paginates 200 per page.
 */
function _getAllWorkspaceUsers_() {
  const users = [];
  let pageToken = null;

  do {
    const page = AdminDirectory.Users.list({
      customer: "my_customer",
      maxResults: 200,
      pageToken: pageToken,
      orderBy: "email",
      query: "",
      projection: "full",
    });

    if (page.users) {
      for (const user of page.users) {
        if (user.suspended || user.archived) continue;
        users.push(user);
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  return users;
}
