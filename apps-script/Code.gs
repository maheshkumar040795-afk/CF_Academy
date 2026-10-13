/**
 * CF Academy — booking → Google Sheet + email
 *
 * Setup (5 minutes):
 *  1. Create a Google Sheet named "CF Academy Bookings".
 *  2. Extensions → Apps Script → paste this file → Save.
 *  3. Set NOTIFY_EMAILS below (both admins).
 *  4. Deploy → New deployment → type "Web app"
 *       Execute as: Me      Who has access: Anyone
 *  5. Copy the Web app URL into js/firebase-config.js → APPS_SCRIPT_URL.
 *  Each website booking then adds a row and emails the admins.
 */

const NOTIFY_EMAILS = "admin1@example.com, admin2@example.com"; // TODO: admin emails
const SHEET_NAME = "Bookings";

const COLUMNS = [
  ["Received at", (b) => new Date()],
  ["Booking ID", (b) => b.bookingNo],
  ["Tuition type", (b) => b.mode],
  ["Student", (b) => b.studentName],
  ["Class", (b) => b.studentClass],
  ["Board", (b) => b.board],
  ["Subjects", (b) => b.subjects],
  ["Area", (b) => b.area],
  ["City", (b) => b.city],
  ["Address", (b) => b.address],
  ["Preferred days", (b) => b.days],
  ["Preferred time", (b) => b.time],
  ["Start from", (b) => b.startDate],
  ["Parent", (b) => b.parentName],
  ["Mobile", (b) => "'" + (b.phone || "")],
  ["Email", (b) => b.email],
  ["Notes", (b) => b.notes],
  ["Status", (b) => "New"]
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!b.parentName || !b.phone) return out({ ok: false, error: "missing fields" });
    // trim every value so the sheet cannot be flooded with huge text
    Object.keys(b).forEach((k) => { if (typeof b[k] === "string") b[k] = b[k].slice(0, 300); });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) sh = ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(COLUMNS.map((c) => c[0]));
      sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold").setBackground("#0E2747").setFontColor("#FFFFFF");
      sh.setFrozenRows(1);
    }
    sh.appendRow(COLUMNS.map((c) => (c[1](b) == null ? "" : c[1](b))));

    if (NOTIFY_EMAILS && NOTIFY_EMAILS.indexOf("example.com") === -1) {
      const lines = COLUMNS.slice(1).map((c) => c[0] + ": " + String(c[1](b) || "").replace(/^'/, ""));
      MailApp.sendEmail({
        to: NOTIFY_EMAILS,
        subject: "New tutor booking " + (b.bookingNo || "") + " — " + (b.subjects || "") + " · " + (b.area || b.city || ""),
        body: "A parent booked a tutor on the CF Academy website.\n\n" + lines.join("\n") +
              "\n\nCall: +91" + b.phone + "\nWhatsApp: https://wa.me/91" + b.phone
      });
    }
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return out({ ok: true, service: "CF Academy bookings" });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
