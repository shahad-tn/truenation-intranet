/**
 * ============================================================
 *  PASSOVER GARMENTS — AUTOMATED MONDAY REMINDER
 *  True Nation Israelite Congregation / Faithful Seams
 * ============================================================
 *
 *  WHAT THIS DOES
 *  Every Monday morning it finds a Gmail draft by its subject line,
 *  takes the HTML out of it, and sends it to the recipient list below.
 *  It stops on its own after the campaign deadline.
 *
 *  WHY A GMAIL DRAFT INSTEAD OF HTML IN THE CODE
 *  So you never have to touch this script again. Want to reword the
 *  email in October? Edit the draft in Gmail. The script picks up
 *  whatever is in there the next time it runs.
 *
 *  ------------------------------------------------------------
 *  FIRST-TIME SETUP (about five minutes, once)
 *  ------------------------------------------------------------
 *  1. Paste the reminder HTML into a new Gmail compose window
 *     (Chrome > Ctrl+A > Ctrl+C > paste into Gmail, same as always).
 *  2. Set the subject to EXACTLY the DRAFT_SUBJECT value below.
 *     Leave the To: field empty. Close the window so it saves as a draft.
 *     Do not send it. Do not delete it — the script reads it every week.
 *  3. In this script: Project Settings (gear icon) > set the time zone
 *     to (GMT-08:00) Los Angeles, or the script will fire on UTC time.
 *  4. Run sendTestToMe() once. Approve the permissions prompt when it
 *     appears. Check your inbox and confirm the email looks right.
 *  5. Run createWeeklyTrigger() once. That's it — it's live.
 *
 *  ------------------------------------------------------------
 *  IMPORTANT: ABOUT THE RECIPIENT LIST
 *  ------------------------------------------------------------
 *  Group aliases (ahchyam@, everyone@) expand to their members.
 *  If those members are ALSO listed individually below, those people
 *  receive the email two or three times. Pick ONE approach:
 *    - Aliases only  → comment out the INDIVIDUALS block
 *    - Individuals only → comment out the GROUP_ALIASES block
 *    - Both → only if you have confirmed there is no overlap
 * ============================================================
 */


/* ============================================================
   CONFIGURATION — the only part you should need to edit
   ============================================================ */

const CONFIG = {

  // Must match the Gmail draft's subject line EXACTLY.
  DRAFT_SUBJECT: 'Passover Garments — Monday check-in',

  // Sending address. Must be a verified alias on the account running
  // this script (check with listMyAliases below). Leave as empty string
  // to send from the account's own address.
  SEND_AS: 'faithfulseams@truenation.org',

  // Display name recipients see in the From field.
  SENDER_NAME: 'Faithful Seams',

  // Where replies go.
  REPLY_TO: 'support@truenation.org',

  // Last day the reminder should send. After this date the script
  // does nothing, so you can leave the trigger in place and forget it.
  // Format: YYYY, MM (0 = January!), DD
  STOP_AFTER: new Date(2026, 10, 13),   // November 13, 2026

  // Hour the email goes out, 24-hour clock, script's time zone.
  SEND_HOUR: 9,

  // Get a short confirmation email each week? Useful for the first
  // few weeks so you know it fired. Set to false once you trust it.
  NOTIFY_ME: true,
  NOTIFY_ADDRESS: 'shahad@truenation.org'
};


/* ============================================================
   RECIPIENTS
   ============================================================ */

// Group aliases — these expand to all their members.
const GROUP_ALIASES = [
  'ahchyam@truenation.org',      // Men's Group
  'everyone@truenation.org'      // Whole congregation
];

// Individually listed people.
const INDIVIDUALS = [
  'samuelnakyla31@gmail.com',
  'jaritaburnett@gmail.com',
  'reneaajayi1948@gmail.com',
  'rdominique738@gmail.com',
  'pinktizzle45@aim.com',
  'jessicadownton71@gmail.com',
  'drezilla03@gmail.com',
  'sarahhaynes@truenation.org',
  'nayah@truenation.org',
  'hendcorn32@yahoo.com',
  'malaakaya@truenation.org',
  'bethanyyadah@gmail.com',
  'ctinabaldwin4@gmail.com',
  'santibrown12@gmail.com',
  'ironnova0@gmail.com',
  'ksmith3441@outlook.com',
  'kehonor@yahoo.com',
  'misterbiggs09@yahoo.com',
  'serita1cpr@yahoo.com',
  'raiyah@truenation.org',
  'hyttm_tbhl_ah5@proton.me',
  'sbaldwinearl@gmail.com',
  'salterfambam@att.net',
  'albertmarion2@gmail.com',
  'marqjacks29@icloud.com',
  'argiebhill@gmail.com',
  'brucebevans2763@gmail.com',
  'israelvoyage@yahoo.com',
  'dariusjohnson99@gmail.com',
  'tbusinesswn@aol.com',
  'travelbillions@gmail.com',
  'sashmstanley@gmail.com',
  'elinistanci16@gmail.com',
  'send2mills@yahoo.com',
  'donellvarnado@gmail.com',
  'sheroniasaunders525@gmail.com',
  'shahad@truenation.org'
];

// Comment out either line below to drop that whole group.
const RECIPIENTS = []
  .concat(GROUP_ALIASES)
  .concat(INDIVIDUALS);


/* ============================================================
   MAIN — this is what the weekly trigger calls
   ============================================================ */

function sendWeeklyReminder() {

  // Past the deadline? Do nothing and log why.
  const today = new Date();
  if (today > CONFIG.STOP_AFTER) {
    Logger.log('Past the campaign deadline. Nothing sent.');
    return;
  }

  const template = getTemplate_();
  const list = cleanList_(RECIPIENTS);

  if (!list.length) {
    throw new Error('Recipient list is empty. Nothing sent.');
  }

  sendTo_(list, template);

  Logger.log('Sent to ' + list.length + ' addresses on ' + today.toDateString());

  if (CONFIG.NOTIFY_ME) {
    GmailApp.sendEmail(
      CONFIG.NOTIFY_ADDRESS,
      'Monday reminder sent — Passover Garments',
      'The weekly reminder went out to ' + list.length + ' addresses on ' +
      today.toDateString() + '.\n\n' +
      'Remaining sends: every Monday until ' + CONFIG.STOP_AFTER.toDateString() + '.\n\n' +
      'To change the wording, edit the Gmail draft titled:\n"' +
      CONFIG.DRAFT_SUBJECT + '"'
    );
  }
}


/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Pulls the HTML body out of the Gmail draft that matches DRAFT_SUBJECT.
 * Throws a clear error rather than sending something wrong.
 */
function getTemplate_() {
  const drafts = GmailApp.getDrafts();

  for (let i = 0; i < drafts.length; i++) {
    const msg = drafts[i].getMessage();
    if (msg.getSubject().trim() === CONFIG.DRAFT_SUBJECT.trim()) {
      return {
        subject: msg.getSubject(),
        htmlBody: msg.getBody(),
        plainBody: msg.getPlainBody()
      };
    }
  }

  throw new Error(
    'No Gmail draft found with the subject "' + CONFIG.DRAFT_SUBJECT + '". ' +
    'Check for a typo, a trailing space, or a deleted draft. ' +
    'Nothing was sent.'
  );
}

/**
 * Lowercases, trims, drops blanks, drops anything that is not an
 * email address, and removes duplicates.
 */
function cleanList_(addresses) {
  const seen = {};
  const clean = [];

  addresses.forEach(function (raw) {
    const addr = String(raw).trim().toLowerCase();

    if (!addr) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      Logger.log('Skipped invalid address: ' + raw);
      return;
    }
    if (seen[addr]) {
      Logger.log('Skipped duplicate: ' + addr);
      return;
    }

    seen[addr] = true;
    clean.push(addr);
  });

  return clean;
}

/**
 * Sends one message with everyone on BCC so nobody sees
 * anyone else's address.
 */
function sendTo_(list, template) {
  const options = {
    htmlBody: template.htmlBody,
    bcc: list.join(','),
    name: CONFIG.SENDER_NAME,
    replyTo: CONFIG.REPLY_TO
  };

  if (CONFIG.SEND_AS) {
    options.from = CONFIG.SEND_AS;
  }

  // "To" is the sending address itself; the real list is on BCC.
  const toSelf = CONFIG.SEND_AS || Session.getActiveUser().getEmail();

  GmailApp.sendEmail(toSelf, template.subject, template.plainBody, options);
}


/* ============================================================
   RUN THESE BY HAND
   ============================================================ */

/**
 * Sends the email to you only. Run this first, every time you
 * change the draft. It does NOT touch the real recipient list.
 */
function sendTestToMe() {
  const template = getTemplate_();
  const me = Session.getActiveUser().getEmail();

  const options = {
    htmlBody: template.htmlBody,
    name: CONFIG.SENDER_NAME,
    replyTo: CONFIG.REPLY_TO
  };
  if (CONFIG.SEND_AS) options.from = CONFIG.SEND_AS;

  GmailApp.sendEmail(me, '[TEST] ' + template.subject, template.plainBody, options);
  Logger.log('Test sent to ' + me);
}

/**
 * Shows what WOULD be sent and to whom, without sending anything.
 * Check the execution log after running.
 */
function dryRun() {
  const template = getTemplate_();
  const list = cleanList_(RECIPIENTS);

  Logger.log('Subject: ' + template.subject);
  Logger.log('Sending as: ' + (CONFIG.SEND_AS || Session.getActiveUser().getEmail()));
  Logger.log('Reply-to: ' + CONFIG.REPLY_TO);
  Logger.log('Stops after: ' + CONFIG.STOP_AFTER.toDateString());
  Logger.log('Recipients (' + list.length + '):');
  list.forEach(function (a) { Logger.log('  ' + a); });
  Logger.log('--- Nothing was sent. ---');
}

/**
 * Confirms which addresses you are allowed to send as.
 * If faithfulseams@truenation.org is not in this list, either add it
 * as an alias in Gmail settings or run this script from that account.
 */
function listMyAliases() {
  Logger.log('Account: ' + Session.getActiveUser().getEmail());
  Logger.log('Aliases: ' + GmailApp.getAliases().join(', '));
}

/**
 * Creates the Monday trigger. Removes any existing ones first so you
 * never end up with two triggers sending two emails.
 */
function createWeeklyTrigger() {
  deleteAllTriggers();

  ScriptApp.newTrigger('sendWeeklyReminder')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(CONFIG.SEND_HOUR)
    .create();

  Logger.log('Trigger created. Sends Mondays around ' + CONFIG.SEND_HOUR +
             ':00 until ' + CONFIG.STOP_AFTER.toDateString() + '.');
}

/**
 * Turns the automation off.
 */
function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log('Removed ' + triggers.length + ' trigger(s).');
}