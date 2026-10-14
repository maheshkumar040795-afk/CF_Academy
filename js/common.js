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
  ["sanskrit", /\bsanskrit/]
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

// Fee status of a student for a month key (YYYY-MM)
export function feeFor(student, payments, mk) {
  const fee = Number(student.monthlyFee) || 0;
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

export function feePill(st) {
  const cls = { Paid: "p-paid", Partial: "p-partial", Due: "p-due", Overdue: "p-late" }[st] || "p-lost";
  return `<span class="pill ${cls}">${esc(st)}</span>`;
}
