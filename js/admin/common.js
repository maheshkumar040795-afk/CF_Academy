// Shared business logic: booking status, tutor matching, fee status
import { esc } from "./ui.js";

const OVERDUE_MS = 2 * 3600e3; // a New booking not called within 2 hours

export function isOverdue(b) {
  return b.status === "New" && !b.claimedBy && Date.now() - (b.createdAt || 0) > OVERDUE_MS;
}

export function statusPill(b) {
  if (isOverdue(b)) {
    const h = Math.floor((Date.now() - b.createdAt) / 3600e3);
    return `<span class="pill p-late">Overdue · ${h}h</span>`;
  }
  const cls = {
    "New": "p-new", "Called": "p-called", "Tutor assigned": "p-assigned",
    "Demo fixed": "p-demo", "Converted": "p-won", "Not interested": "p-lost"
  }[b.status] || "p-new";
  return `<span class="pill ${cls}">${esc(b.status || "New")}</span>`;
}

// ── Subject normalisation so "Maths" matches "Mathematics" etc. ──
const SUBJECT_RULES = [
  ["mathematics", /\bmath|\bmaths|\bmathematics|\bbusiness math/],
  ["science", /\bscience\b|\bevs\b|\bgeneral science/],
  ["physics", /\bphy/],
  ["chemistry", /\bchem/],
  ["biology", /\bbio|\bbotany|\bzoology/],
  ["english", /\beng/],
  ["tamil", /\btamil/],
  ["hindi", /\bhindi/],
  ["social science", /\bsocial|\bhistory|\bgeography|\bcivics|\bsst\b/],
  ["accountancy", /\baccount/],
  ["commerce", /\bcommerce|\bbusiness stud/],
  ["economics", /\beco/],
  ["computer science", /\bcomputer|\bcs\b|\bpython|\bjava\b|\bcoding/],
  ["french", /\bfrench/],
  ["sanskrit", /\bsanskrit/],
  // competitive exams
  ["neet", /\bneet\b/],
  ["jee", /\bjee\b|\biit.?jee/],
  ["tnpsc", /\btnpsc|\bgroup\s?(1|2|4|i|ii|iv)\b/],
  ["upsc", /\bupsc|\bias\b|\bcivil serv/],
  ["ssc", /\bssc\b/],
  ["banking", /\bbank|\bibps|\bsbi\b/],
  ["railway", /\brrb\b|\brailway/],
  ["tet", /\btet\b|\bctet|\btntet/],
  ["ca foundation", /\bca\b|\bca foundation|\bchartered/],
  ["clat", /\bclat\b/],
  ["cuet", /\bcuet\b/],
  ["nda", /\bnda\b|\bdefence/],
  ["gate", /\bgate\b|\btancet/],
  ["olympiad", /\bolympiad|\bntse/]
];
export function canonSubjects(str) {
  const s = String(str || "").toLowerCase();
  const out = new Set();
  SUBJECT_RULES.forEach(([name, re]) => { if (re.test(s)) out.add(name); });
  if (/\ball subjects?\b/.test(s)) out.add("all");
  return out;
}

function classNum(c) {
  const s = String(c || "").toLowerCase();
  if (/lkg|ukg|pre.?kg|nursery/.test(s)) return 0;
  const m = s.match(/\d{1,2}/);
  return m ? Number(m[0]) : null;
}
function classRangeOk(tutorClasses, studentClass) {
  const n = classNum(studentClass);
  if (n == null || !tutorClasses) return null;
  const s = String(tutorClasses).toLowerCase();
  if (/all/.test(s)) return true;
  const nums = (s.match(/\d{1,2}/g) || []).map(Number);
  const hasKG = /lkg|ukg|kg/.test(s);
  if (!nums.length) return hasKG ? n === 0 : null;
  const lo = hasKG ? 0 : Math.min(...nums);
  const hi = Math.max(...nums);
  return n >= lo && n <= hi;
}
const words = (s) => String(s || "").toLowerCase().split(/[,/;|]+|\s+/).map((w) => w.trim()).filter((w) => w.length >= 3);

// Rank tutors for a booking. Returns [{t, score, hits:{subject, area, city, mode, cls}}]
export function matchTutors(b, tutors, limit = 8) {
  const want = canonSubjects(b.subjects);
  const online = /online/i.test(b.mode || "");
  const bArea = String(b.area || "").toLowerCase().trim();
  const bAreaWords = words(b.area);
  const bCity = String(b.city || "").toLowerCase().replace(/\(.*\)/, "").trim();
  const out = [];
  for (const t of tutors || []) {
    if ((t.status || "Active") === "Inactive") continue;
    const have = canonSubjects(t.subjects);
    let subjHits = 0;
    if (want.has("all")) subjHits = have.size ? 1 : 0;
    else want.forEach((s) => { if (have.has(s) || have.has("all")) subjHits++; });
    if (want.size && !subjHits) continue;

    const tArea = String(t.area || "").toLowerCase();
    const tCity = String(t.city || "").toLowerCase();
    const tMode = String(t.mode || "").toLowerCase();
    const areaHit = !online && !!bArea && (tArea.includes(bArea) || bAreaWords.some((w) => tArea.includes(w)));
    const cityHit = !!bCity && !!tCity && (tCity.includes(bCity) || bCity.includes(tCity));
    const doesOnline = /online|both|all/.test(tMode);
    const doesHome = !tMode || /home|both|all|offline/.test(tMode);
    const modeHit = online ? doesOnline : doesHome;
    const cls = classRangeOk(t.classes, b.studentClass);

    let score = subjHits * 10;
    if (online) { score += doesOnline ? 8 : -6; if (cityHit) score += 1; }
    else { if (areaHit) score += 9; if (cityHit) score += 4; if (!doesHome) score -= 8; }
    if (cls === true) score += 3;
    if (cls === false) score -= 4;
    score += Math.min(Number(t.experience) || 0, 15) / 5;
    out.push({ t, score, hits: { subject: subjHits > 0, area: areaHit, city: cityHit, mode: modeHit, cls } });
  }
  return out.sort((a, b2) => b2.score - a.score).slice(0, limit);
}

// ── GST on tuition fee ──
// student.monthlyFee is the fee entered by the admin (before GST). When student.gst is on,
// 18% GST is added: ₹5,000 → ₹5,000 + ₹900 GST = ₹5,900 payable every month.
export const GST_RATE = 18;
export function gstOf(base) { return Math.round((Number(base) || 0) * GST_RATE) / 100; }
// Fee history: when the fee or GST changes, the new values apply from a chosen month and the
// months before keep the old fee. student.feeHistory = [{ from: "YYYY-MM", monthlyFee, gst }]
// (no history = the current fee applies to every month).
export function feeAt(s, mk) {
  const h = ((s && s.feeHistory) || []).filter((x) => x && x.from).slice().sort((a, b) => a.from.localeCompare(b.from));
  if (!h.length || !mk) return { monthlyFee: s && s.monthlyFee, gst: !!(s && s.gst) };
  // the latest entry always follows the student's current fee / GST
  const last = { ...h[h.length - 1], monthlyFee: s.monthlyFee, gst: !!s.gst };
  h[h.length - 1] = last;
  let cur = h[0];
  for (const x of h) if (x.from <= mk) cur = x;
  return { monthlyFee: cur.monthlyFee, gst: !!cur.gst };
}
export function feeHistoryAfterChange(old, newFee, newGst, fromMk) {
  let h = ((old && old.feeHistory) || []).filter((x) => x && x.from).slice();
  if (!h.length) h = [{ from: String(old.joinDate || "2000-01").slice(0, 7), monthlyFee: Number(old.monthlyFee) || 0, gst: !!old.gst }];
  h = h.filter((x) => x.from < fromMk);
  h.push({ from: fromMk, monthlyFee: Number(newFee) || 0, gst: !!newGst });
  return h;
}
// mk optional: the fee that applied in that month
export function feeParts(s, mk) {
  const f = mk ? feeAt(s, mk) : { monthlyFee: s && s.monthlyFee, gst: !!(s && s.gst) };
  const base = Number(f.monthlyFee) || 0;
  const gst = f.gst ? gstOf(base) : 0;
  return { base, gst, total: Math.round((base + gst) * 100) / 100, on: !!f.gst };
}
export const monthlyTotal = (s, mk) => feeParts(s, mk).total;
// Was the student studying in that month? (joined by its end; active, or stopped on/after its 1st)
export function activeInMonth(s, mk) {
  if (s.joinDate && s.joinDate > mk + "-31") return false;
  if ((s.status || "Active") === "Active") return true;
  return !!s.leftOn && s.leftOn >= mk + "-01";
}
// "₹ 5,900" with a small "₹ 5,000 + 18% GST" line underneath (for tables / cards)
export function feeHTML(s, inr) {
  const p = feeParts(s);
  return p.on ? `${inr(p.total)}<span class="sub">${inr(p.base)} + ${GST_RATE}% GST</span>` : inr(p.base);
}
// Monthly fee input + GST switch, used in Add / Edit student and Convert to student
export function gstFieldsHTML(v = {}) {
  return `
    <div class="fld"><label>Monthly fee (₹) *</label><input name="monthlyFee" type="number" min="0" step="50" value="${esc(v.monthlyFee == null ? "" : v.monthlyFee)}" data-gst-base></div>
    <div class="fld"><label>GST (${GST_RATE}%)</label>
      <label class="switch"><input type="checkbox" name="gst" data-gst-on ${v.gst ? "checked" : ""}><span class="sw" aria-hidden="true"></span><span data-gst-state>${v.gst ? "GST on" : "GST off"}</span></label></div>
    <div class="fld full"><div class="note gst-note" data-gst-out></div></div>`;
}
export function bindGst(root, inr) {
  const base = root.querySelector("[data-gst-base]"), on = root.querySelector("[data-gst-on]");
  const out = root.querySelector("[data-gst-out]"), state = root.querySelector("[data-gst-state]");
  if (!base || !on || !out) return;
  const upd = () => {
    const b = Number(base.value) || 0;
    state.textContent = on.checked ? "GST on" : "GST off";
    out.className = "note gst-note" + (on.checked ? " ok" : "");
    out.innerHTML = !b ? "Enter the monthly fee." : on.checked
      ? `Fee ${inr(b)} + GST ${GST_RATE}% ${inr(gstOf(b))} = <b>${inr(b + gstOf(b))}</b> per month`
      : `GST off — parent pays <b>${inr(b)}</b> per month`;
  };
  base.addEventListener("input", upd); on.addEventListener("change", upd); upd();
}
// GST split of an amount that already includes GST (for receipts). Tamil Nadu: CGST 9% + SGST 9%.
export function splitGst(amount) {
  const total = Number(amount) || 0;
  const taxable = Math.round((total * 100 / (100 + GST_RATE)) * 100) / 100;
  const gst = Math.round((total - taxable) * 100) / 100;
  const cgst = Math.round((gst / 2) * 100) / 100;
  return { total, taxable, gst, cgst, sgst: Math.round((gst - cgst) * 100) / 100 };
}

// Fee status of a student for a month key (YYYY-MM) — fee includes GST when it is on
export function feeFor(student, payments, mk) {
  const fee = monthlyTotal(student, mk);
  const paid = payments
    .filter((p) => p.studentId === student.id && (p.monthKeys || [p.monthKey]).includes(mk))
    .reduce((sum, p) => sum + (Number(p.amount) || 0) / Math.max(1, (p.monthKeys || [p.monthKey]).length), 0);
  const balance = Math.max(0, Math.round(fee - paid));
  let status = "Due";
  if (fee && paid >= fee - 0.5) status = "Paid";
  else if (paid > 0) status = "Partial";
  if (!fee) status = paid ? "Paid" : "No fee set";
  return { fee, paid: Math.round(paid), balance, status };
}

// ── Fee due date & reminder window ──
export const DUE_SOON_DAYS = 3;
const pISO = (v) => { if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null; const [y, m, d] = v.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
// Day of the month the fee is due: set on the student, else the joining day, else the 5th
export function dueDay(s) {
  const n = Number(s.feeDueDay);
  if (n >= 1 && n <= 31) return n;
  const j = pISO(s.joinDate);
  return j ? j.getDate() : 5;
}
export function dueDateFor(s, mk) {
  const [y, m] = mk.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const d = new Date(y, m - 1, Math.min(dueDay(s), last));
  const j = pISO(s.joinDate);
  return j && j > d && j.getFullYear() === y && j.getMonth() === m - 1 ? j : d;
}
// What the ₹ fee icon shows for a student this month:
// paid · upcoming (more than 3 days away) · soon (within 3 days) · today · late (overdue)
export function feeDue(s, payments, today = new Date()) {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const mk = t0.getFullYear() + "-" + String(t0.getMonth() + 1).padStart(2, "0");
  const f = feeFor(s, payments, mk);
  const due = dueDateFor(s, mk);
  const days = Math.round((due - t0) / 864e5);
  const j = pISO(s.joinDate);
  const dLabel = due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  // unpaid balance from the previous month (only if the student had joined by then)
  const pm = new Date(t0.getFullYear(), t0.getMonth() - 1, 1);
  const pmk = pm.getFullYear() + "-" + String(pm.getMonth() + 1).padStart(2, "0");
  const prev = !j || j <= new Date(pm.getFullYear(), pm.getMonth() + 1, 0) ? feeFor(s, payments, pmk) : null;
  const prevDue = prev && prev.fee && prev.balance > 0 ? prev.balance : 0;
  let kind, label;
  if (!f.fee) { kind = "none"; label = "No fee set"; }
  else if (j && j > t0 && (j.getFullYear() > t0.getFullYear() || j.getMonth() > t0.getMonth())) { kind = "upcoming"; label = "Starts " + j.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  else if (f.status === "Paid") { kind = "paid"; label = "Paid"; }
  else if (days > DUE_SOON_DAYS) { kind = "upcoming"; label = "Due " + dLabel; }
  else if (days > 0) { kind = "soon"; label = `Due in ${days} day${days === 1 ? "" : "s"}`; }
  else if (days === 0) { kind = "today"; label = "Due today"; }
  else { kind = "late"; label = `Overdue ${-days} day${days === -1 ? "" : "s"}`; }
  return { ...f, mk, due, days, kind, label, prevDue };
}
export function feeDuePill(d) {
  const cls = { paid: "p-paid", upcoming: "p-lost", soon: "p-soon", today: "p-late", late: "p-late", none: "p-lost" }[d.kind] || "p-lost";
  return `<span class="pill ${cls}">${esc(d.label)}</span>`;
}

export function feePill(st) {
  const cls = { Paid: "p-paid", Partial: "p-partial", Due: "p-due", Overdue: "p-late" }[st] || "p-lost";
  return `<span class="pill ${cls}">${esc(st)}</span>`;
}

// ── Tutor allocation with history (used by Student Allocation and Edit student) ──
// Keeps every tutor's stint so tutor salary pays each tutor for the days they taught.
// t = { id, name, phone } or null (remove tutor); on = "YYYY-MM-DD" the change takes effect
export function allocationPatch(s, t, on, by) {
  let hist = (s.allocationHistory || []).slice();
  // older students have no history yet: record the current tutor's stint first
  if (!hist.length && s.tutorId) hist.push({ tutorId: s.tutorId, tutorName: s.tutorName || "", on: s.allocatedOn || s.joinDate || on, by: "" });
  hist.push({ tutorId: t ? t.id : "", tutorName: t ? t.name : "", on, by: by || "" });
  hist = hist.slice(-40);
  return t
    ? { tutorId: t.id, tutorName: t.name, tutorPhone: String(t.phone || "").replace(/\D/g, "").slice(-10), allocatedOn: on, allocatedBy: by || "", allocationHistory: hist }
    : { tutorId: "", tutorName: "", tutorPhone: "", allocatedOn: "", allocationHistory: hist };
}
