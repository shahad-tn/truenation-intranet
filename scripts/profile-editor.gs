/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRUE NATION INTRANET — Self-Service Profile Editor (My Dashboard)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Standalone Apps Script web app embedded on the My Dashboard page.
 * Staff update their own record in the Staff Data Sheet.
 * Uses Session.getActiveUser().getEmail() — no identifier field needed.
 *
 * DEPLOYMENT:
 *   Execute as: User accessing the web app
 *   Who has access: Anyone in True Nation (truenation.org domain)
 *   To update: Deploy → Manage Deployments → Edit (pencil) → New version → Deploy
 *   URL stays the same after each version update.
 *
 * FIELDS USERS CAN EDIT:
 *   Name & Identity  — hebrew_first, hebrew_last, legal_first, legal_middle, legal_last,
 *                      gender, date_of_birth
 *   Contact          — phone, personal_email, address1, address2, city, state, zip
 *   Campus           — location (7-campus dropdown)
 *   Emergency 1      — emergency_name, emergency_phone, emergency_relationship
 *   Emergency 2      — ec2_name, ec2_phone, ec2_relationship
 *   Skills & Ministry — skills, ministry_interests
 *   Insurance        — insurance_provider, insurance_policy, insurance_dependents
 *
 * READ-ONLY (shown for context):
 *   branch, department, title_role, employment_type
 *
 * BEHAVIOR:
 *   • Only non-empty submitted fields are written — blank = no change
 *   • Every save is logged to the Audit Log tab
 *   • Server-side email check — users can only update their own record
 *   • Writes to ec2_ columns for Emergency Contact 2
 */

// ── CONFIGURATION ──────────────────────────────────────────────────────────
const PE_CONFIG = {
  SHEET_ID:  '1b88y_ic5vYHwcITXblYRMUFGtOOYbyvnQBupvVBVBIk',
  DATA_TAB:  'data',
  AUDIT_TAB: 'Audit Log',

  // Columns users are allowed to edit (must match sheet header row exactly)
  EDITABLE_COLS: [
    // Name & Identity
    'hebrew_first', 'hebrew_last',
    'legal_first', 'legal_middle', 'legal_last',
    'gender', 'date_of_birth',
    // Contact
    'phone', 'personal_email',
    'address1', 'address2', 'city', 'state', 'zip',
    // Campus
    'location',
    // Emergency Contact 1
    'emergency_name', 'emergency_phone', 'emergency_relationship',
    // Emergency Contact 2 (ec2_ columns — emergency_name2/phone2/relationship2 removed)
    'ec2_name', 'ec2_phone', 'ec2_relationship',
    // Skills & Ministry
    'skills', 'ministry_interests',
    // Insurance
    'insurance_provider', 'insurance_policy', 'insurance_dependents',
  ],

  // Columns shown as read-only context
  READONLY_COLS: ['branch', 'department', 'title_role', 'employment_type'],

  // Campus options for the dropdown
  CAMPUSES: [
    'Los Angeles, CA',
    'Detroit, MI',
    'Macon, GA',
    'Manila, Philippines',
    'Cebu, Philippines',
    'Kumasi, Ghana',
    'Accra, Ghana',
  ],
};


// ── ENTRY POINT ────────────────────────────────────────────────────────────

/**
 * Routes requests by ?widget= parameter.
 *   ?widget=identity   → Identity Card widget (dashboard embed)
 *   ?widget=department → My Department widget (dashboard embed)
 *   (no param)         → Self-service profile editor form
 */
function doGet(e) {
  const widget = (e && e.parameter) ? (e.parameter.widget || '') : '';

  if (widget === 'identity')   return serveIdentityWidget_();
  if (widget === 'department') return serveDepartmentWidget_();

  // Default: full profile editor form
  const email    = Session.getActiveUser().getEmail();
  const userData = pe_getUserData_(email);

  const template        = HtmlService.createTemplateFromFile('profile-editor-ui');
  template.userDataJson = JSON.stringify(userData);
  template.userEmail    = email;
  template.campuses     = JSON.stringify(PE_CONFIG.CAMPUSES);

  return template.evaluate()
    .setTitle('Update Your Profile — True Nation')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// ── DASHBOARD WIDGETS ──────────────────────────────────────────────────────

/**
 * Serves the Identity Card widget for the My Dashboard page.
 * Shows: time-based greeting, full name, department, branch, campus.
 */
function serveIdentityWidget_() {
  const email    = Session.getActiveUser().getEmail();
  const userData = pe_getUserData_(email);
  const html     = buildIdentityHtml_(userData, email);

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Serves the My Department widget for the My Dashboard page.
 * Shows: dept icon, dept name, title/role, branch, and action buttons.
 */
function serveDepartmentWidget_() {
  const email    = Session.getActiveUser().getEmail();
  const userData = pe_getUserData_(email);
  const html     = buildDepartmentHtml_(userData, email);

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── WIDGET HTML BUILDERS ───────────────────────────────────────────────────

function buildIdentityHtml_(userData, email) {
  const firstName = esc_(userData.hebrew_first  || userData.legal_first  || email.split('@')[0]);
  const lastName  = esc_(userData.hebrew_last   || userData.legal_last   || '');
  const fullName  = lastName ? firstName + ' ' + lastName : firstName;
  const dept      = esc_(userData.department || '');
  const branch    = esc_(userData.branch     || '');
  const campus    = esc_(userData.location   || '');

  const metaTags = [
    dept   ? `<span class="dash-tag"><span class="dash-tag-icon" aria-hidden="true">🏢</span>${dept}</span>`   : '',
    branch ? `<span class="dash-tag"><span class="dash-tag-icon" aria-hidden="true">🏛</span>${branch}</span>` : '',
    campus ? `<span class="dash-tag"><span class="dash-tag-icon" aria-hidden="true">📍</span>${campus}</span>` : '',
  ].join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .dash-id {
    font-family: 'DM Sans', sans-serif;
    background: linear-gradient(135deg, #7C1316 0%, #5a0e10 100%);
    border-radius: 14px;
    padding: 28px 24px 24px;
    color: #F2F2F3;
    position: relative;
    overflow: hidden;
  }
  .dash-id::after {
    content: '';
    position: absolute;
    top: -30px; right: -30px;
    width: 120px; height: 120px;
    background: rgba(201,151,44,0.12);
    border-radius: 50%;
    pointer-events: none;
  }
  .dash-greeting { font-size: 14px; opacity: 0.8; margin-bottom: 4px; }
  .dash-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 1.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    line-height: 1.2;
    margin-bottom: 12px;
  }
  .dash-meta { display: flex; flex-wrap: wrap; gap: 8px; }
  .dash-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    background: rgba(255,255,255,0.15);
    padding: 4px 12px;
    border-radius: 100px;
  }
  .dash-tag-icon { font-size: 14px; }
  @media (max-width: 480px) {
    .dash-id { padding: 22px 18px 20px; }
    .dash-name { font-size: 1.4rem; }
  }
</style>
</head>
<body>
<div class="dash-id" role="banner">
  <div class="dash-greeting" id="greeting" aria-live="polite">Welcome back</div>
  <div class="dash-name">${fullName}</div>
  <div class="dash-meta" aria-label="Your profile details">${metaTags}</div>
</div>
<script>
  (function () {
    var h = new Date().getHours();
    var salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('greeting').textContent = salutation + ', ${firstName}';
  })();
</script>
</body>
</html>`;
}

function buildDepartmentHtml_(userData, email) {
  const dept    = esc_(userData.department  || 'Unknown Department');
  const branch  = esc_(userData.branch      || '');
  const role    = esc_(userData.title_role  || '');

  // Map department name to an icon
  const DEPT_ICONS = {
    'it':                         '💻',
    'it / information technology':'💻',
    'marketing':                  '📣',
    'performing arts':            '🎭',
    'everyday sheeple':           '🎬',
    'publications':               '📰',
    'publication':                '📰',
    'disciples':                  '📖',
    'cbd':                        '🌍',
    'clerical':                   '📋',
    'custodial':                  '🧹',
    'fellowship & service':       '🤝',
    'stewardship':                '💰',
    'holistic health & healing':  '💚',
    'maintenance':                '🔧',
    'safety & facilities':        '🛡️',
    'textiles & attire':          '👕',
    'counseling':                 '🕊️',
    'ministries':                 '✡️',
    't.e.l.a.':                   '⭐',
  };
  const icon = DEPT_ICONS[(userData.department || '').toLowerCase()] || '🏢';

  const branchBadge = branch
    ? `<span class="dept-branch" aria-label="Branch: ${branch}">${branch}</span>`
    : '';

  const roleText = role
    ? `<div class="dept-role" aria-label="Your role">${role}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .dept-wrap {
    font-family: 'DM Sans', sans-serif;
    background: #E8E8EC;
    border-radius: 10px;
    padding: 16px 16px 20px;
    box-sizing: border-box;
    width: 100%;
  }
  .dept-card {
    background: white;
    border: 1px solid #BFBFC7;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 6px rgba(19,13,10,0.05);
  }
  .dept-row { display: flex; align-items: flex-start; gap: 14px; }
  .dept-icon {
    width: 48px; height: 48px;
    background: #E8E8EC;
    border: 1px solid #BFBFC7;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
    aria-hidden: true;
  }
  .dept-info { flex: 1; min-width: 0; }
  .dept-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #7C1316;
    margin-bottom: 4px;
  }
  .dept-role {
    font-size: 13px;
    color: #56565E;
    font-weight: 500;
    margin-bottom: 4px;
  }
  .dept-branch {
    display: inline-block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #C9972C;
    background: white;
    border: 1px solid #BFBFC7;
    padding: 2px 8px;
    border-radius: 100px;
  }
  .dept-links { display: flex; gap: 8px; margin-top: 16px; }
  .dept-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 16px;
    border-radius: 6px;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .dept-btn:hover { opacity: 0.85; }
  .dept-btn:focus-visible {
    outline: 2px solid #C9972C;
    outline-offset: 2px;
  }
  .dept-btn-primary { background: #7C1316; color: #F2F2F3; }
  .dept-btn-secondary { background: white; border: 1px solid #BFBFC7; color: #56565E; }
  @media (max-width: 480px) {
    .dept-links { flex-direction: column; }
    .dept-btn { justify-content: center; }
  }
</style>
</head>
<body>
<div class="dept-wrap">
  <div class="dept-card">
    <div class="dept-row">
      <div class="dept-icon" aria-hidden="true">${icon}</div>
      <div class="dept-info">
        <div class="dept-name">${dept}</div>
        ${roleText}
        ${branchBadge}
      </div>
    </div>
    <div class="dept-links">
      <!-- [REPLACE] href with actual Google Sites department page URL -->
      <a class="dept-btn dept-btn-primary" href="#" aria-label="Go to ${dept} department page">🏢 Department Page</a>
      <!-- [REPLACE] href with Google Chat space URL when set up -->
      <a class="dept-btn dept-btn-secondary" href="#" aria-label="Open ${dept} Chat Space">💬 Chat Space</a>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── UTILITY ────────────────────────────────────────────────────────────────

/** HTML-escapes a string for safe injection into template literals. */
function esc_(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}


// ── CLIENT-CALLABLE FUNCTIONS ──────────────────────────────────────────────

/**
 * Returns the logged-in user's current profile data.
 * @returns {Object} userData object
 */
function getMyProfile() {
  const email = Session.getActiveUser().getEmail();
  return pe_getUserData_(email);
}

/**
 * Updates the logged-in user's record.
 * Only writes non-empty editable fields; blank = no change.
 *
 * @param {Object} formData  Keys from EDITABLE_COLS, values from the form.
 * @returns {Object}  { success: boolean, updated: string[], message?: string }
 */
function updateMyProfile(formData) {
  const email = Session.getActiveUser().getEmail();

  if (!email) {
    return { success: false, message: 'Could not identify your account. Are you signed in?' };
  }

  const ss      = SpreadsheetApp.openById(PE_CONFIG.SHEET_ID);
  const sheet   = ss.getSheetByName(PE_CONFIG.DATA_TAB);
  const headers = pe_getHeaders_(sheet);
  const H       = pe_headerMap_(headers);

  const rowIndex = pe_findRow_(sheet, H, email);
  if (rowIndex === -1) {
    return { success: false, message: 'Your record was not found in the directory.' };
  }

  // Capture before-values for audit
  const rowData = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const before  = {};
  headers.forEach((h, i) => { before[h] = String(rowData[i] || ''); });

  // Write only non-empty editable fields
  const updated = [];
  for (const field of PE_CONFIG.EDITABLE_COLS) {
    const value = formData[field];
    if (H[field] && value !== undefined && String(value).trim() !== '') {
      const trimmed = String(value).trim();
      // Only write if value actually changed
      if (trimmed !== before[field]) {
        sheet.getRange(rowIndex, H[field]).setValue(trimmed);
        updated.push(field);
      }
    }
  }

  pe_auditLog_(ss, email, updated, formData, before);

  return { success: true, updated: updated };
}


// ── PRIVATE HELPERS ────────────────────────────────────────────────────────

function pe_getUserData_(email) {
  const ss      = SpreadsheetApp.openById(PE_CONFIG.SHEET_ID);
  const sheet   = ss.getSheetByName(PE_CONFIG.DATA_TAB);
  const headers = pe_getHeaders_(sheet);
  const H0      = {};
  headers.forEach((h, i) => { if (h) H0[h] = i; });

  const allCols = [...PE_CONFIG.EDITABLE_COLS, ...PE_CONFIG.READONLY_COLS, 'email'];
  const data    = sheet.getDataRange().getValues();
  const norm    = email.toLowerCase().trim();

  for (let i = 1; i < data.length; i++) {
    const rowEmail = String(data[i][H0['email']] || '').toLowerCase().trim();
    if (rowEmail !== norm) continue;

    const result = { found: true, email: data[i][H0['email']] || email };
    for (const col of allCols) {
      if (col === 'email') continue;
      result[col] = H0[col] != null ? String(data[i][H0[col]] || '') : '';
    }
    return result;
  }

  return { found: false, email: email };
}

function pe_findRow_(sheet, H, email) {
  const norm    = email.toLowerCase().trim();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !H['email']) return -1;

  const emails = sheet.getRange(2, H['email'], lastRow - 1, 1).getValues();
  for (let i = 0; i < emails.length; i++) {
    if (String(emails[i][0] || '').toLowerCase().trim() === norm) {
      return i + 2;
    }
  }
  return -1;
}

function pe_auditLog_(ss, email, updated, formData, before) {
  try {
    const auditSheet = ss.getSheetByName(PE_CONFIG.AUDIT_TAB);
    if (!auditSheet) return;
    if (updated.length === 0) return;
    const summary = updated.map(f => {
      const oldVal = before ? (before[f] || '(empty)') : '';
      const newVal = String(formData[f] || '').trim();
      return `${f}: "${oldVal}" → "${newVal}"`;
    }).join('; ');
    auditSheet.appendRow([
      new Date().toISOString(), email, email,
      'self_profile_update', 'multiple', '', summary
    ]);
  } catch (e) {
    Logger.log('Audit log error: ' + e.message);
  }
}

function pe_getHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
}

function pe_headerMap_(headers) {
  const map = {};
  headers.forEach((h, i) => { if (h) map[h] = i + 1; });
  return map;
}
