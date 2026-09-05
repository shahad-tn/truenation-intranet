// ============================================================
// RIDE FOR MY BREWS — Google Apps Script
// Updated to route between multiple forms via formType field.
// Soccer registrations are handled by TELAsoccer.gs.
// ============================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    Logger.log("doPost received formType: " + data.formType);

    // ── Route to the correct handler based on formType ──────────
    if (data.formType === "soccer") {
      return handleSoccerRegistration(data); // defined in TELAsoccer.gs
    }

    // ── Default: Ride for My Brews registration ──────────────────
    var BREWS_SPREADSHEET_ID = "1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk";
    var sheet = SpreadsheetApp.openById(BREWS_SPREADSHEET_ID).getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Name",
        "Email",
        "Phone",
        "Adults",
        "Children",
        "Children Details",
        "Participation",
        "Own Bike",
        "Adult Bike Rentals",
        "Kids Bike Rentals",
        "Child Trailer",
        "Helmet Situation",
        "Adult Helmets Needed",
        "Child Helmets Needed",
        "Party Setup Help",
        "Bringing Food",
        "Food Description",
        "Bringing Drinks",
        "Drink Description",
        "Bringing Gear",
        "Emergency Contact Name",
        "Emergency Contact Phone",
        "Medical/Allergies",
        "Can Transport Bikes",
        "Ride Volunteer",
        "Bluetooth Speaker for Ride",
        "Fire Pit Contribution",
        "Fire Pit Amount"
      ]);
      sheet.getRange(1, 1, 1, 29).setFontWeight("bold");
    }

    sheet.appendRow([
      new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
      data.name || "",
      data.email || "",
      data.phone || "",
      data.numAdults || 0,
      data.numChildren || 0,
      data.childrenDetails || "",
      data.participation || "",
      data.ownBike || "",
      data.rentalAdult || 0,
      data.rentalKids || 0,
      data.needTrailer || "",
      data.helmetSituation || "",
      data.helmetsNeededAdult || 0,
      data.helmetsNeededChild || 0,
      data.partySetupHelp || "",
      data.bringingFood || "",
      data.foodDescription || "",
      data.bringingDrinks || "",
      data.drinkDescription || "",
      (data.bringingGear || []).join(", "),
      data.emergencyName || "",
      data.emergencyPhone || "",
      data.medical || "",
      data.canTransport || "",
      data.volunteer || "",
      data.rideSpeaker || "",
      data.firePitContribution || "",
      data.firePitAmount || ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handles CORS preflight requests
function doGetBrews(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ready" }))
    .setMimeType(ContentService.MimeType.JSON);
}