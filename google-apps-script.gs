/* ============================================================
   AKKOUS — Google Apps Script Backend
   
   DEPLOYMENT INSTRUCTIONS:
   
   1. Go to https://script.google.com and create a new project
   2. Replace the default code with this entire file
   3. Update the configuration constants below
   4. Run the function "setupSheet" once (select it, click Run)
      → creates the "Project Requests" sheet with column headers
   5. Click "Deploy" > "New deployment"
   6. Select type: "Web app"
   7. Execute as: "Me"
   8. Who has access: "Anyone"
   9. Click "Deploy" and copy the Web App URL
   10. Paste the URL into js/config.js > GOOGLE_SCRIPT_API_URL
   
   ============================================================ */

/* ---- CONFIGURATION ---- */

// Your Google Spreadsheet ID (from the URL: docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit)
const SPREADSHEET_ID = "1juhgZytxV8Ih4zGiqnLcU3RRctECkf9NT0tfx_nTZdw";

// Sheet tab name
const SHEET_NAME = "systems";

// Admin email for notifications
const ADMIN_EMAIL = "onouari@invooffice.com";

// Agency name used in client confirmation email
const AGENCY_NAME = "AKKOUS";

// Max description length (must match frontend config)
const MAX_DESCRIPTION_LENGTH = 5000;


/* ---- ANTI-ABUSE CONFIGURATION ---- */

// Origin allow-list (defense in depth — see isTrustedSource()).
// Apps Script Web Apps do NOT reliably expose the Origin/Referer HTTP
// headers to doGet/doPost, so this is an OPT-IN guard: it only rejects
// requests that carry an explicit origin hint failing this list, and it
// NEVER blocks requests with no hint. The frontend sends no hint today.
const ALLOWED_ORIGINS = [
  "https://www.akkous.com",
  "https://www.akkous.com/"
];

// Global rate limit. Apps Script provides no reliable client IP for an
// "Anyone" Web App, so the throttle is a GLOBAL fixed-window counter kept
// in script properties (timestamps only — no personal data stored).
// Window: THROTTLE_WINDOW_SECONDS (120 s). Budget: THROTTLE_MAX_PER_WINDOW
// (3 accepted submissions — enough for a couple of simultaneous humans).
// Fail-open: if script properties are unavailable, requests are NOT blocked.
const THROTTLE_WINDOW_SECONDS = 120;
const THROTTLE_MAX_PER_WINDOW = 3;
const THROTTLE_PROP_KEY = "akkous_throttle";


/* ---- DO GET (required for Web App deployment) ---- */

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, message: "AKKOUS Project Request API is running." })
  ).setMimeType(ContentService.MimeType.JSON);
}


/* ---- DO POST (main entry point) ---- */

function doPost(e) {
  var lock = LockService.getScriptLock();
  
  try {
    // Acquire lock to prevent concurrent write issues
    lock.waitLock(10000);
    
    var data = JSON.parse(e.postData.contents);
    
    // --- Anti-abuse: honeypot (discard, no sheet write, no email) ---
    if (isHoneypotTriggered(data)) {
      Logger.log("Blocked: honeypot triggered.");
      return decoySuccess();
    }
    
    // --- Anti-abuse: origin allow-list (defense in depth, fail-open) ---
    if (!isTrustedSource(e, data)) {
      Logger.log("Blocked: untrusted origin/referer hint.");
      return decoySuccess();
    }
    
    // --- Validate required fields ---
    var name  = trim(data.name);
    var email = trim(data.email);
    var whatsapp = trim(data.whatsapp);
    var desc  = trim(data.projectDescription);
    
    if (!name || !email || !whatsapp || !desc) {
      return jsonResponse(false, "All fields are required.");
    }
    
    // --- Validate email format ---
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(false, "Invalid email address.");
    }
    
    // --- Validate description length ---
    if (desc.length > MAX_DESCRIPTION_LENGTH) {
      return jsonResponse(false, "Project description exceeds the maximum allowed length.");
    }
    
    // --- Anti-abuse: global rate limit (fail-open, before any write) ---
    if (!tryReserveThrottleSlot()) {
      Logger.log("Blocked: throttle window exhausted.");
      return jsonResponse(false, "Too many requests. Please try again later.");
    }
    
    // --- Write to Google Sheets ---
    var sheet = getOrCreateSheet();
    var timestamp = new Date();
    
    sheet.appendRow([
      timestamp,    // Date
      name,         // Client Name
      email,        // Email
      whatsapp,     // WhatsApp
      desc,         // Project Description
      "New"         // Status
    ]);
    
    // --- Send admin notification email ---
    sendAdminEmail(name, email, whatsapp, desc, timestamp);
    
    // --- Send client confirmation email ---
    sendClientEmail(name, email);
    
    Logger.log("Request received from: " + name + " (" + email + ")");
    return jsonResponse(true, "Project request successfully received");
    
  } catch (err) {
    Logger.log("Error: " + err.message);
    return jsonResponse(false, "Server error. Please try again later.");
    
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


/* ---- HELPERS ---- */

function trim(val) {
  return (typeof val === "string") ? val.trim() : "";
}

function jsonResponse(success, message) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: success, message: message })
  ).setMimeType(ContentService.MimeType.JSON);
}


/* ---- ANTI-ABUSE HELPERS ---- */

/**
 * Honeypot: the frontend never sends the optional "website" field, so a
 * human can never trip it. Any non-empty value = automated bot.
 */
function isHoneypotTriggered(data) {
  try {
    return typeof data.website === "string" && data.website.trim() !== "";
  } catch (e) {
    return false;
  }
}

/**
 * Origin/Referer guard (defense in depth, fail-open).
 * Returns true when the request is trusted: no origin hint present, or every
 * hint matches the allow-list. Returns false only on a POSITIVE mismatch.
 * Hints are read from URL query params (e.parameter) and from the JSON body.
 * Apps Script does not expose the real HTTP headers, so this never replaces
 * real filtering — it only drops requests that openly claim a foreign origin.
 */
function isTrustedSource(e, data) {
  var hints = [];

  if (e && e.parameter) {
    if (e.parameter.origin)  hints.push(e.parameter.origin);
    if (e.parameter.referer) hints.push(e.parameter.referer);
  }
  if (data && typeof data === "object") {
    if (data.origin)  hints.push(data.origin);
    if (data.referer) hints.push(data.referer);
  }
  if (hints.length === 0) return true;

  var allowed = {};
  for (var i = 0; i < ALLOWED_ORIGINS.length; i++) {
    allowed[normalizeOrigin(ALLOWED_ORIGINS[i])] = true;
  }

  for (var j = 0; j < hints.length; j++) {
    var norm = normalizeOrigin(hints[j]);
    if (norm !== "" && allowed[norm] !== true) return false;
  }
  return true;
}

/** Reduces a value to scheme://authority (no path, no trailing slash), or "". */
function normalizeOrigin(value) {
  var m = String(value).trim().toLowerCase().match(/^https?:\/\/[^/]+/);
  return m ? m[0] : "";
}

/**
 * Global throttle — fixed 120 s window, budget 3 accepted submissions.
 * Atomically increments the counter (serialized by the caller's lock) and
 * returns false once the window budget is exhausted. Fail-open: any
 * PropertiesService error allows the request through, so a storage problem
 * can never take the site down.
 */
function tryReserveThrottleSlot() {
  try {
    var props = PropertiesService.getScriptProperties();
    var state = { start: 0, count: 0 };

    var raw = props.getProperty(THROTTLE_PROP_KEY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed.count === "number") state = parsed;
      } catch (e) {
        /* corrupt stored value — start a fresh window */
      }
    }

    var now = Date.now();
    if (now - state.start >= THROTTLE_WINDOW_SECONDS * 1000) {
      state = { start: now, count: 0 };
    }
    state.count += 1;
    props.setProperty(THROTTLE_PROP_KEY, JSON.stringify(state));

    return state.count <= THROTTLE_MAX_PER_WINDOW;
  } catch (err) {
    return true; // fail-open
  }
}

/**
 * Decoy success so a bot cannot distinguish a blocked request from a real
 * one (identical shape and message to the normal success response).
 */
function decoySuccess() {
  return jsonResponse(true, "Project request successfully received");
}


/* ---- SPREADSHEET ---- */

/**
 * Run this function manually from the Apps Script editor to
 * create/initialize the sheet with its column headers.
 * Select the function "setupSheet" and click "Run".
 */
function setupSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    Logger.log("Sheet \"" + SHEET_NAME + "\" created.");
  }

  writeHeaders(sheet);
  Logger.log("Headers ready on \"" + SHEET_NAME + "\": Date | Client Name | Email | WhatsApp | Project Description | Status");
  Logger.log("Spreadsheet URL: " + ss.getUrl());
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    writeHeaders(sheet);
  }

  return sheet;
}

/**
 * Writes the column headers at row 1 and formats them.
 * Idempotent: skipped when headers already exist, and never
 * overwrites a first row that already contains data.
 */
function writeHeaders(sheet) {
  var HEADERS = [
    "Date",
    "Client Name",
    "Email",
    "WhatsApp",
    "Project Description",
    "Status"
  ];

  // Already set up — do not duplicate
  if (sheet.getRange(1, 1).getValue() === HEADERS[0]) return;

  // Row 1 has data but no headers — do not clobber it
  var firstRowHasData = sheet.getRange(1, 1, 1, HEADERS.length)
    .isBlank()[0]
    .some(function (blank) { return !blank; });
  if (firstRowHasData) {
    Logger.log("Warning: row 1 already contains data without headers. Headers NOT written on \"" + SHEET_NAME + "\".");
    return;
  }

  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);

  // Format header row
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#1a1d2e");
  headerRange.setFontColor("#ffffff");

  // Set column widths
  sheet.setColumnWidth(1, 160);  // Date
  sheet.setColumnWidth(2, 180);  // Name
  sheet.setColumnWidth(3, 220);  // Email
  sheet.setColumnWidth(4, 160);  // WhatsApp
  sheet.setColumnWidth(5, 400);  // Description
  sheet.setColumnWidth(6, 100);  // Status

  // Freeze header row
  sheet.setFrozenRows(1);
}


/* ---- ADMIN EMAIL NOTIFICATION ---- */

function sendAdminEmail(name, email, whatsapp, desc, timestamp) {
  var subject = "\uD83D\uDD14 New Project Request \u2013 " + name;
  
  var body =
    "Hello,\n\n" +
    "You have received a new project request.\n\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "Client Name:\n" + name + "\n\n" +
    "Email:\n" + email + "\n\n" +
    "WhatsApp:\n" + whatsapp + "\n\n" +
    "Project Description:\n" + desc + "\n\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "Date: " + timestamp + "\n\n" +
    "Please check your Google Sheet to manage this request.\n\n" +
    "Regards,\n" + AGENCY_NAME + " Website";
  
  MailApp.sendEmail(ADMIN_EMAIL, subject, body);
}


/* ---- CLIENT CONFIRMATION EMAIL ---- */

function sendClientEmail(name, clientEmail) {
  var subject = "Thank You for Your Project Request";
  
  var body =
    "Hello " + name + ",\n\n" +
    "Thank you for contacting us and for sharing your project with us.\n\n" +
    "We have successfully received your request and our team will carefully review the details you provided.\n\n" +
    "A member of our team will contact you soon to discuss your project and the next steps.\n\n" +
    "Best regards,\n" +
    AGENCY_NAME;
  
  MailApp.sendEmail(clientEmail, subject, body);
}
