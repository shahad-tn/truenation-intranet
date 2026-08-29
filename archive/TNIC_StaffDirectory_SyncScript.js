/**
 * ═══════════════════════════════════════════════════════════════
 * TRUE NATION INTRANET — Staff Directory Sync Script
 * ═══════════════════════════════════════════════════════════════
 *
 * PURPOSE:
 * Syncs Google Workspace users into the "Staff Directory" sheet.
 * Pulls Email, First Name, and Last Name from the Admin SDK.
 * Preserves manually-entered columns (Department, Branch, Campus, etc.).
 *
 * SETUP:
 * 1. Open this Google Sheet → Extensions → Apps Script
 * 2. Paste this entire file into the script editor
 * 3. Click "+" next to Services → add "Admin SDK API" (adminDirectoryV1) → Add
 * 4. Also enable Admin SDK in Google Cloud Console:
 *    console.cloud.google.com → APIs & Services → Enable API → "Admin SDK API"
 * 5. Run syncWorkspaceUsers() once manually (click Run → approve permissions)
 * 6. Set up a daily trigger:
 *    Triggers (clock icon) → Add Trigger →
 *    Function: syncWorkspaceUsers
 *    Event source: Time-driven → Day timer → 2am-3am
 *
 * WHAT IT DOES:
 * - Fetches all users from your Google Workspace domain
 * - For NEW users: adds a row with Email, First Name, Last Name
 * - For EXISTING users: updates First/Last Name only (if changed in Workspace)
 * - NEVER overwrites: Department, Branch, Campus, Title, Sub-Groups, etc.
 * - Marks Sync Source as "Apps Script" and timestamps Last Synced
 * - Skips suspended/archived users
 *
 * IMPORTANT:
 * - You must be a Google Workspace admin (or delegated admin) to run this
 * - The script only READS from Workspace (no write access needed)
 * - Multi-campus members: add their second campus row manually
 *   (the script won't create duplicate rows for the same email)
 *
 * COLUMN MAP (must match the sheet exactly):
 * A=Email, B=First Name, C=Last Name, D=Display Name, E=Title/Role,
 * F=Department, G=Branch, H=Campus, I=Sub-Groups, J=Chat Space URL,
 * K=Dept Page URL, L=Phone, M=Profile Photo URL, N=Sync Source,
 * O=Last Synced, P=Active
 */

// ─── CONFIGURATION ───
const CONFIG = {
  SHEET_NAME: "Staff Directory",
  // Column indices (1-based)
  COL_EMAIL: 1,        // A
  COL_FIRST: 2,        // B
  COL_LAST: 3,         // C
  COL_DISPLAY: 4,      // D
  COL_TITLE: 5,        // E
  COL_DEPT: 6,         // F
  COL_BRANCH: 7,       // G
  COL_CAMPUS: 8,       // H
  COL_SUBGROUPS: 9,    // I
  COL_CHAT_URL: 10,    // J
  COL_DEPT_URL: 11,    // K
  COL_PHONE: 12,       // L
  COL_PHOTO: 13,       // M
  COL_SOURCE: 14,      // N
  COL_SYNCED: 15,      // O
  COL_ACTIVE: 16,      // P
  TOTAL_COLS: 16,
};


/**
 * Main sync function — call this manually or via trigger.
 */
function syncWorkspaceUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error(`Sheet "${CONFIG.SHEET_NAME}" not found. Create it first.`);
  }

  // ─── 1. Load existing emails from sheet ───
  const lastRow = sheet.getLastRow();
  const existingEmails = {};  // email → row number

  if (lastRow > 1) {
    const emailRange = sheet.getRange(2, CONFIG.COL_EMAIL, lastRow - 1, 1).getValues();
    for (let i = 0; i < emailRange.length; i++) {
      const email = String(emailRange[i][0]).toLowerCase().trim();
      if (email) {
        existingEmails[email] = i + 2;  // row number (1-indexed, skip header)
      }
    }
  }

  // ─── 2. Fetch all users from Google Workspace ───
  const workspaceUsers = getAllWorkspaceUsers_();
  const now = new Date();
  let newCount = 0;
  let updateCount = 0;

  // ─── 3. Process each Workspace user ───
  for (const user of workspaceUsers) {
    const email = user.primaryEmail.toLowerCase().trim();
    const firstName = user.name?.givenName || "";
    const lastName = user.name?.familyName || "";

    if (existingEmails[email]) {
      // ─── EXISTING USER: update name only ───
      const row = existingEmails[email];

      // Update First/Last name if changed in Workspace
      const currentFirst = sheet.getRange(row, CONFIG.COL_FIRST).getValue();
      const currentLast = sheet.getRange(row, CONFIG.COL_LAST).getValue();

      if (currentFirst !== firstName || currentLast !== lastName) {
        sheet.getRange(row, CONFIG.COL_FIRST).setValue(firstName);
        sheet.getRange(row, CONFIG.COL_LAST).setValue(lastName);
        updateCount++;
      }

      // Always update sync metadata
      sheet.getRange(row, CONFIG.COL_SOURCE).setValue("Apps Script");
      sheet.getRange(row, CONFIG.COL_SYNCED).setValue(now);

    } else {
      // ─── NEW USER: add row ───
      const newRow = sheet.getLastRow() + 1;
      const rowData = new Array(CONFIG.TOTAL_COLS).fill("");

      rowData[CONFIG.COL_EMAIL - 1] = email;
      rowData[CONFIG.COL_FIRST - 1] = firstName;
      rowData[CONFIG.COL_LAST - 1] = lastName;
      rowData[CONFIG.COL_DISPLAY - 1] = firstName;  // Default display name = first name
      rowData[CONFIG.COL_SOURCE - 1] = "Apps Script";
      rowData[CONFIG.COL_SYNCED - 1] = now;
      rowData[CONFIG.COL_ACTIVE - 1] = "TRUE";

      // Try to pull phone from Workspace profile
      if (user.phones && user.phones.length > 0) {
        rowData[CONFIG.COL_PHONE - 1] = user.phones[0].value || "";
      }

      // Try to pull photo
      if (user.thumbnailPhotoUrl) {
        rowData[CONFIG.COL_PHOTO - 1] = user.thumbnailPhotoUrl;
      }

      sheet.getRange(newRow, 1, 1, CONFIG.TOTAL_COLS).setValues([rowData]);
      newCount++;
    }
  }

  // ─── 4. Log results ───
  const msg = `Sync complete: ${workspaceUsers.length} Workspace users processed. ` +
              `${newCount} new, ${updateCount} updated.`;
  Logger.log(msg);
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Staff Directory Sync", 10);
}


/**
 * Fetch all active users from Google Workspace via Admin SDK.
 * Handles pagination (200 users per page).
 * Skips suspended and archived accounts.
 */
function getAllWorkspaceUsers_() {
  const users = [];
  let pageToken = null;

  do {
    const page = AdminDirectory.Users.list({
      customer: "my_customer",      // "my_customer" = your own domain
      maxResults: 200,
      pageToken: pageToken,
      orderBy: "email",
      query: "",                    // all users
      projection: "full",          // include phone, photo, etc.
    });

    if (page.users) {
      for (const user of page.users) {
        // Skip suspended or archived accounts
        if (user.suspended || user.archived) continue;
        users.push(user);
      }
    }

    pageToken = page.nextPageToken;
  } while (pageToken);

  return users;
}


/**
 * Optional: Run this to mark users who are in the sheet but NOT in Workspace
 * as Active = FALSE. Useful for detecting departed members.
 */
function flagInactiveUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return;

  // Get all Workspace emails
  const workspaceUsers = getAllWorkspaceUsers_();
  const wsEmails = new Set(workspaceUsers.map(u => u.primaryEmail.toLowerCase().trim()));

  // Check each sheet row
  const emailRange = sheet.getRange(2, CONFIG.COL_EMAIL, lastRow - 1, 1).getValues();
  let flagged = 0;

  for (let i = 0; i < emailRange.length; i++) {
    const email = String(emailRange[i][0]).toLowerCase().trim();
    const row = i + 2;

    if (email && !wsEmails.has(email)) {
      const currentActive = sheet.getRange(row, CONFIG.COL_ACTIVE).getValue();
      if (String(currentActive) !== "FALSE") {
        sheet.getRange(row, CONFIG.COL_ACTIVE).setValue("FALSE");
        flagged++;
      }
    }
  }

  const msg = `Flagged ${flagged} users as inactive (not found in Workspace).`;
  Logger.log(msg);
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Inactive Users", 10);
}


/**
 * Creates a custom menu in the Google Sheet for easy access.
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("TNIC Directory")
    .addItem("Sync Workspace Users", "syncWorkspaceUsers")
    .addItem("Flag Inactive Users", "flagInactiveUsers")
    .addToUi();
}
