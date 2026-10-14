// Reports — bookings, conversion, collections, tutor-wise students
import { $, esc, inr, exportXlsx, monthKey, monthLabel, lastMonths, todayISO, ICONS } from "./ui.js";
import { canonSubjects } from "./common.js";
import { BOOKING_STATUSES } from "../site-config.js";

const st = { range: "6" };
let root, ctx;

function inRange(ms) {
  if (st.range === "all") return true;
  const months = Number(st.range);
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() - (months - 1), 1).getTime();
  return (ms || 0) >= start;
}

function render(view, c) {
  root = view; ctx = c;
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Reports</h1><p>Live numbers from bookings, students and payments.</p></div>
      <div class="actions">
        <div class="fld" style="min-width:170px"><label for="rRange">Period</label><select id="rRange">
          <option value="1">This month</option><option value="3">Last 3 months</option><option value="6">Last 6 months</option><option value="12">Last 12 months</option><option value="all">All time</option>
        </select></div>
        <button class="btn btn-ghost" id="rpExport" style="align-self:flex-end">${ICONS.download}Download Excel</button>
        <button class="btn btn-ghost" id="rpPrint" style="align-self:flex-end">${ICONS.print}Print</button>
      </div>
    </div>
    <div class="stats" id="rpStats"></div>
    <div class="grid2" id="rpGrid"></div>`;
  $("#rRange", view).value = st.range;
  $("#rRange", view).addEventListener("change", (e) => { st.range = e.target.value; refresh(); });
  $("#rpExport", view).addEventListener("click", exportReport);
  $("#rpPrint", view).addEventListener("click", () => {
    $("#rpGrid", root).classList.add("print-area");
    window.print();
    setTimeout(() => $("#rpGrid", root) && $("#rpGrid", root).classList.remove("print-area"), 500);
  });
  refresh();
  if (ctx.tutors == null) ctx.ensureTutors().catch(() => {});
}

function countBy(arr, fn) {
  const m = new Map();
  arr.forEach((x) => { (fn(x) || []).forEach((k) => { if (k) m.set(k, (m.get(k) || 0) + 1); }); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function bars(entries, fmt = (v) => v) {
  if (!entries.length) return `<p class="sub">No data yet.</p>`;
  const max = Math.max(...entries.map((e) => e[1])) || 1;
  return `<div class="bars">${entries.map(([k, v], i) => `
    <div class="bar-row"><span>${esc(k)}</span><div class="track"><div class="fill ${i === 0 ? "top" : ""}" style="width:${Math.max(2, (v / max) * 100)}%"></div></div><span class="v">${esc(fmt(v))}</span></div>`).join("")}</div>`;
}
const cap = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const EXAM_LABEL = { neet: "NEET", jee: "JEE", tnpsc: "TNPSC", upsc: "UPSC", ssc: "SSC", tet: "TET / CTET", clat: "CLAT", cuet: "CUET",
  nda: "NDA / Defence", gate: "GATE / TANCET", "ca foundation": "CA Foundation", railway: "RRB Railway", banking: "Banking exams", olympiad: "Olympiad / NTSE" };
const subjLabel = (k) => EXAM_LABEL[k] || cap(k);

// When a student became a student: created date, else join date
function admittedAt(s) {
  if (s.createdAt) return s.createdAt;
  const [y, m, d] = String(s.joinDate || "").split("-").map(Number);
  return y ? new Date(y, m - 1, d).getTime() : 0;
}
const isDirect = (s) => !s.bookingId;

function data() {
  const bk = ctx.bookings.filter((b) => inRange(b.createdAt));
  const web = bk.filter((b) => b.source === "website").length;
  const phoneLeads = bk.length - web;
  const admitted = ctx.students.filter((s) => inRange(admittedAt(s)));
  const direct = admitted.filter(isDirect).length;
  const fromBookings = admitted.length - direct;
  const pays = ctx.payments.filter((p) => {
    const [y, m, d] = String(p.date || "").split("-").map(Number);
    return inRange(y ? new Date(y, m - 1, d).getTime() : p.createdAt);
  });
  const converted = bk.filter((b) => b.status === "Converted").length;
  const collected = pays.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const bySubject = countBy(bk, (b) => [...canonSubjects(b.subjects)].map(subjLabel)).slice(0, 10);
  const byStatus = BOOKING_STATUSES.map((s) => [s, bk.filter((b) => (b.status || "New") === s).length]).filter((e) => e[1]);
  const byPlace = countBy(bk, (b) => [b.mode === "Online tuition" ? "Online" : (b.area ? cap(String(b.area).trim().toLowerCase()) : b.city)]).slice(0, 10);
  const months = lastMonths(st.range === "all" ? 12 : Math.max(Number(st.range), 3));
  const monthly = months.map((mk) => [mk, ctx.payments.filter((p) => String(p.date || "").slice(0, 7) === mk).reduce((a, p) => a + (Number(p.amount) || 0), 0)]);
  const monthlyBk = months.map((mk) => [mk, ctx.bookings.filter((b) => monthKey(new Date(b.createdAt)) === mk).length]);
  const monthlyAdm = months.map((mk) => [mk, ctx.students.filter((s) => admittedAt(s) && monthKey(new Date(admittedAt(s))) === mk).length]);
  const monthlyDirect = months.map((mk) => [mk, ctx.students.filter((s) => isDirect(s) && admittedAt(s) && monthKey(new Date(admittedAt(s))) === mk).length]);
  const bySource = [["Website bookings", web], ["Phone / walk-in leads", phoneLeads], ["Students from bookings", fromBookings], ["Direct admissions (added in admin)", direct]];
  const tutorRows = new Map();
  ctx.students.filter((s) => (s.status || "Active") === "Active" && s.tutorId).forEach((s) => {
    const r = tutorRows.get(s.tutorId) || { name: s.tutorName, students: 0, fees: 0 };
    r.students++; r.fees += Number(s.monthlyFee) || 0;
    tutorRows.set(s.tutorId, r);
  });
  const tutorsTop = [...tutorRows.values()].sort((a, b) => b.students - a.students);
  return { bk, pays, converted, collected, bySubject, byStatus, byPlace, monthly, monthlyBk, tutorsTop, web, phoneLeads, admitted, direct, fromBookings, monthlyAdm, monthlyDirect, bySource };
}

function refresh() {
  if (!root || !document.body.contains(root)) return;
  const d = data();
  const conv = d.bk.length ? Math.round((d.converted / d.bk.length) * 100) : 0;
  const callTimes = d.bk.filter((b) => b.claimedAt && b.createdAt && b.source === "website").map((b) => b.claimedAt - b.createdAt).filter((x) => x > 0);
  const avgCall = callTimes.length ? callTimes.reduce((a, b) => a + b, 0) / callTimes.length : 0;
  const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} m`; };
  $("#rpStats", root).innerHTML = `
    <div class="stat"><span>Bookings / leads</span><b>${d.bk.length}</b><span>${d.web} website · ${d.phoneLeads} phone / walk-in</span></div>
    <div class="stat good"><span>Bookings converted</span><b>${d.converted} <span style="font-size:14px">${conv}%</span></b></div>
    <div class="stat"><span>Direct admissions</span><b>${d.direct}</b><span>Called &amp; added in admin</span></div>
    <div class="stat good"><span>Total new students</span><b>${d.admitted.length}</b><span>Bookings + direct</span></div>
    <div class="stat"><span>Fees collected</span><b>${inr(d.collected)}</b></div>
    <div class="stat"><span>Avg. time to first call</span><b>${callTimes.length ? fmtDur(avgCall) : "—"}</b></div>`;

  const maxM = Math.max(1, ...d.monthly.map((m) => m[1]));
  const maxB = Math.max(1, ...d.monthlyBk.map((m) => m[1]));
  const cols = (arr, max, fmt) => `
    <div class="cols">${arr.map(([mk, v], i) => `<div class="c ${i === arr.length - 1 ? "last" : ""}"><span>${esc(fmt(v))}</span><div class="b" style="height:${(v / max) * 150}px"></div></div>`).join("")}</div>
    <div class="col-labels">${arr.map(([mk]) => `<span>${esc(monthLabel(mk).slice(0, 3))}</span>`).join("")}</div>`;
  const k = (v) => (v >= 100000 ? (v / 100000).toFixed(1) + "L" : v >= 1000 ? Math.round(v / 1000) + "k" : String(v));

  $("#rpGrid", root).innerHTML = `
    <div class="panel"><h2>Fees collected by month (₹)</h2>${cols(d.monthly, maxM, k)}</div>
    <div class="panel"><h2>Bookings by month</h2>${cols(d.monthlyBk, maxB, String)}</div>
    <div class="panel"><h2>New students by month <span class="sub" style="display:inline;font-weight:400">· incl. direct admissions</span></h2>${cols(d.monthlyAdm, Math.max(1, ...d.monthlyAdm.map((m) => m[1])), String)}
      <p class="sub" style="margin-top:8px">Direct admissions: ${d.monthlyDirect.map(([mk, v]) => `${esc(monthLabel(mk).slice(0, 3))} ${v}`).join(" · ")}</p></div>
    <div class="panel"><h2>Leads &amp; admissions by source</h2>${bars(d.bySource)}</div>
    <div class="panel"><h2>Bookings by subject</h2>${bars(d.bySubject)}</div>
    <div class="panel"><h2>Bookings by status</h2>${bars(d.byStatus)}</div>
    <div class="panel"><h2>Top areas (home) and online</h2>${bars(d.byPlace)}</div>
    <div class="panel"><h2>Tutor-wise active students</h2>${d.tutorsTop.length ? `
      <div class="table-wrap"><table class="t"><thead><tr><th>Tutor</th><th class="num">Students</th><th class="num">Monthly fees</th></tr></thead>
      <tbody>${d.tutorsTop.slice(0, 15).map((t) => `<tr><td>${esc(t.name)}</td><td class="num">${t.students}</td><td class="num">${inr(t.fees)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="sub">No students assigned to tutors yet.</p>`}
    </div>`;
}

function exportReport() {
  const d = data();
  exportXlsx({
    "Summary": [{ "Period": $("#rRange", root).selectedOptions[0].textContent, "Bookings / leads": d.bk.length, "Website bookings": d.web, "Phone / walk-in leads": d.phoneLeads,
      "Bookings converted": d.converted, "Direct admissions": d.direct, "Total new students": d.admitted.length, "Fees collected": d.collected }],
    "New students by month": d.monthlyAdm.map(([mk, v], i) => ({ Month: monthLabel(mk), "New students": v, "Of which direct": d.monthlyDirect[i][1] })),
    "Collections by month": d.monthly.map(([mk, v]) => ({ Month: monthLabel(mk), Amount: v })),
    "Bookings by subject": d.bySubject.map(([k2, v]) => ({ Subject: k2, Bookings: v })),
    "Bookings by status": d.byStatus.map(([k2, v]) => ({ Status: k2, Bookings: v })),
    "Bookings by area": d.byPlace.map(([k2, v]) => ({ Area: k2, Bookings: v })),
    "Tutor-wise students": d.tutorsTop.map((t) => ({ Tutor: t.name, "Active students": t.students, "Monthly fees": t.fees }))
  }, `CF-Academy-Report-${todayISO()}.xlsx`);
}

export default { deps: ["bookings", "students", "payments"], render, refresh };
