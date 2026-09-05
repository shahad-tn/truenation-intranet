// ============================================================
//  TELA SOCCER — True Nation Intramural Soccer Registration
//  Add this file to your existing Apps Script project.
//
//  HOW IT WORKS:
//  This file does NOT define doPost() or doGet() — those are
//  already owned by Code.gs and ride_for_my_brews.gs.
//  Instead, the shared doPost() in ride_for_my_brews.gs routes
//  to handleSoccerRegistration() when formType === "soccer".
//  See the updated ride_for_my_brews.gs for the routing logic.
// ============================================================

var SOCCER_SHEET_NAME  = "Soccer Registrations";
var SOCCER_NOTIFY_EMAIL = "tournament-ops@truenation.org";

/**
 * Handles an incoming soccer registration submission.
 * Called by doPost() in ride_for_my_brews.gs when data.formType === "soccer".
 * @param {Object} data - Parsed JSON payload from the signup form.
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function handleSoccerRegistration(data) {
  Logger.log("handleSoccerRegistration called. playerFirstName: " + data.playerFirstName);

  // ── Server-side age validation (safety net in case client is bypassed) ──
  var ageNum = parseInt(data.age, 10);
  if (isNaN(ageNum) || ageNum < 6 || ageNum > 17) {
    Logger.log("Rejected: age out of range (" + data.age + ")");
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: "Player age must be between 6 and 17. Received: " + data.age
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var SOCCER_SPREADSHEET_ID = "1T5aMFZ1N9ksSeH3iyj8s2rCKiUGg7PoYujRnIqqVy4s";
  var ss    = SpreadsheetApp.openById(SOCCER_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SOCCER_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SOCCER_SHEET_NAME);
    var headers = [
      "Timestamp",
      "Player First Name",
      "Player Last Name",
      "Date of Birth",
      "Age",
      "Parent / Guardian Name",
      "Parent Phone",
      "Parent Email",
      "Emergency Contact Name",
      "Emergency Contact Phone",
      "Emergency Contact Relationship",
      "Medical Conditions / Allergies",
      "Practice Availability (May 3)",
      "Practice Availability (May 17)",
      "Practice Availability (May 24)",
      "Agreed to Rules & Regulations",
      "Submission Date"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#1D9E75")
      .setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }

  var timestamp = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });

  sheet.appendRow([
    timestamp,
    data.playerFirstName   || "",
    data.playerLastName    || "",
    data.dob               || "",
    data.age               || "",
    data.parentName        || "",
    data.parentPhone       || "",
    data.parentEmail       || "",
    data.emergencyName     || "",
    data.emergencyPhone    || "",
    data.emergencyRelation || "",
    data.medical           || "None",
    data.practice1         || "No",
    data.practice2         || "No",
    data.practice3         || "No",
    data.agreedToRules     || "No",
    new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })
  ]);

  Logger.log("Row written to sheet successfully.");

  // ── Email notification ───────────────────────────────────────────
  try {
    var playerName = (data.playerFirstName || "") + " " + (data.playerLastName || "");
    var subject    = "New Soccer Registration: " + playerName.trim();
    var body =
      "A new player has registered for the TELA Intramural Soccer Tournament.\n" +
      "Submitted: " + timestamp + "\n\n" +
      "── PLAYER ──────────────────────────────\n" +
      "Name:          " + playerName.trim()        + "\n" +
      "Date of Birth: " + (data.dob || "")         + "\n" +
      "Age:           " + (data.age || "")         + "\n\n" +
      "── PARENT / GUARDIAN ───────────────────\n" +
      "Name:          " + (data.parentName  || "") + "\n" +
      "Phone:         " + (data.parentPhone || "") + "\n" +
      "Email:         " + (data.parentEmail || "") + "\n\n" +
      "── EMERGENCY CONTACT ───────────────────\n" +
      "Name:          " + (data.emergencyName     || "") + "\n" +
      "Phone:         " + (data.emergencyPhone    || "") + "\n" +
      "Relationship:  " + (data.emergencyRelation || "") + "\n\n" +
      "── MEDICAL / ALLERGIES ─────────────────\n" +
      (data.medical || "None") + "\n\n" +
      "── PRACTICE AVAILABILITY ───────────────\n" +
      "May 3:         " + (data.practice1 || "No") + "\n" +
      "May 17:        " + (data.practice2 || "No") + "\n" +
      "May 24:        " + (data.practice3 || "No") + "\n\n" +
      "── REGISTRATION ────────────────────────\n" +
      "Agreed to Rules: " + (data.agreedToRules || "No") + "\n\n" +
      "View all registrations:\n" +
      "https://docs.google.com/spreadsheets/1T5aMFZ1N9ksSeH3iyj8s2rCKiUGg7PoYujRnIqqVy4s";

    GmailApp.sendEmail(SOCCER_NOTIFY_EMAIL, subject, body);
    Logger.log("Notification email sent to " + SOCCER_NOTIFY_EMAIL);
  } catch (emailErr) {
    Logger.log("Email send failed (non-fatal): " + emailErr.toString());
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Test function ────────────────────────────────────────────────────────────
function testSoccerSubmission() {
  var mockData = {
    formType:          "soccer",
    playerFirstName:   "Test",
    playerLastName:    "Player",
    dob:               "2015-06-01",
    age:               "10",
    parentName:        "Test Parent",
    parentPhone:       "555-555-5555",
    parentEmail:       "test@test.com",
    emergencyName:     "Emergency Contact",
    emergencyPhone:    "555-555-0000",
    emergencyRelation: "Grandparent",
    medical:           "None",
    practice1:         "Yes",
    practice2:         "No",
    practice3:         "Yes",
    agreedToRules:     "Yes"
  };
  var result = handleSoccerRegistration(mockData);
  Logger.log(result.getContent());
}