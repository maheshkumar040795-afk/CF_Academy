// Tutor salary (Finance) — weekly / monthly salary from the tutor's per-hour rate
// and the classes of the students allocated to them. Leave days are deducted
// manually, then the payout is saved as Pending or marked Paid.
//
// Data: tutorPayouts/{id} = { tutorId, tutorName, tutorPhone, periodType: "month"|"week",
//   periodKey: "2026-10" | "2026-10-12" (week start, Monday), periodLabel, rate,
//   lines: [{ studentId, studentName, days, hoursPerClass, classes, hours, amount }],
//   gross, leaveDays, leaveHoursPerDay, leaveDeduction, adjustment, adjustNote, alreadyPaid, net,
//   status: "Pending"|"Paid", paidOn, payMode, reference, paidBy, createdAt }
import { put, remove } from "../db.js";
import { SITE } from "../site-config.js";
import { $, $$, esc, inr, fmtDate, fmtPhone, normPhone, toast, modal, confirmBox, options, exportXlsx, todayISO, monthKey, monthLabel, lastMonths, waLink, ICONS } from "./ui.js";

// ── Class days & hours ──
const DAY_WORDS = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6
};
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monFirst = (a, b) => ((a + 6) % 7) - ((b + 6) % 7);

// "Mon, Wed, Fri · 6 – 8 PM" → [1, 3, 5]; also "Mon - Sat", "daily", "weekdays", "weekends"
export function parseDays(str) {
  const s = String(str || "").toLowerCase();
  if (/\b(daily|every ?day|all days)\b/.test(s)) return [1, 2, 3, 4, 5, 6, 0];
  const set = new Set();
  if (/\bweekdays\b/.test(s)) [1, 2, 3, 4, 5].forEach((d) => set.add(d));
  if (/\bweekends?\b/.test(s)) [6, 0].forEach((d) => set.add(d));
  const tok = s.match(/[a-z]+|[-–]/g) || [];
  for (let i = 0; i < tok.length; i++) {
    const a = DAY_WORDS[tok[i]];
    if (a == null) continue;
    const b = DAY_WORDS[tok[i + 2]];
    if (/^(-|–|to)$/.test(tok[i + 1] || "") && b != null) {
      for (let d = a, n = 0; n < 7; n++, d = (d + 1) % 7) { set.add(d); if (d === b) break; }
      i += 2;
    } else set.add(a);
  }
  return [...set].sort(monFirst);
}
export const daysText = (days) => days.map((d) => DAY_SHORT[d]).join(", ");

// "6 – 8 PM" → 2, "10 AM – 12 PM" → 2, "4:30 - 6 PM" → 1.5; 0 when no time range is found
export function parseHours(str) {
  const m = String(str || "").toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return 0;
  const toH = (h, mi, ap) => { let x = Number(h) % 12 + (Number(mi) || 0) / 60; if (ap === "pm") x += 12; return x; };
  const endAp = m[6] || m[3];
  const startAp = m[3] || (endAp === "pm" && Number(m[1]) > Number(m[4]) && Number(m[1]) !== 12 ? "am" : endAp);
  let diff = toH(m[4], m[5], endAp) - toH(m[1], m[2], startAp);
  if (diff <= 0) diff += 12;
  return diff > 0 && diff <= 8 ? Math.round(diff * 4) / 4 : 0;
}

export function classInfo(s) {
  const days = parseDays(s.classDays || s.schedule);
  const hrs = Number(s.classHours) || parseHours(s.schedule) || 1;
  return { days, hours: hrs };
}

// ── Periods ──
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const parseISO = (v) => { if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null; const [y, m, d] = v.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

export function periodRange(type, key) {
  if (type === "week") { const s = parseISO(key); const e = new Date(s); e.setDate(e.getDate() + 6); return [s, e]; }
  const [y, m] = key.split("-").map(Number);
  return [new Date(y, m - 1, 1), new Date(y, m, 0)];
}
export function periodLabel(type, key) {
  if (type === "month") return monthLabel(key);
  const [s, e] = periodRange("week", key);
  const f = (d, y) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(y ? { year: "numeric" } : {}) });
  return `${f(s)} – ${f(e, true)}`;
}
export function periodChoices(type) {
  if (type === "month") return lastMonths(12).reverse();
  const out = [];
  const m = mondayOf(new Date());
  for (let i = 0; i < 10; i++) { const d = new Date(m); d.setDate(d.getDate() - 7 * i); out.push(iso(d)); }
  return out;
}
export const currentPeriod = (type) => (type === "month" ? monthKey() : iso(mondayOf(new Date())));

function countClasses(days, from, to) {
  let n = 0;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) if (days.includes(d.getDay())) n++;
  return n;
}

// Salary line for one student in a period. edit = { days: "Mon, Wed", hours: 1.5 } (unsaved changes)
export function salaryLine(s, rate, type, key, edit) {
  const info = classInfo(s);
  const days = edit && edit.days != null ? parseDays(edit.days) : info.days;
  const hoursPerClass = edit && edit.hours != null ? Number(edit.hours) || 0 : info.hours;
  const [ps, pe] = periodRange(type, key);
  const starts = [ps, parseISO(s.joinDate), parseISO(s.allocatedOn)].filter(Boolean);
  const from = new Date(Math.max(...starts.map((d) => d.getTime())));
  const classes = days.length && from <= pe ? countClasses(days, from, pe) : 0;
  const hours = Math.round(classes * hoursPerClass * 100) / 100;
  const startsLate = from > ps ? from : null;
  return { studentId: s.id, studentName: s.name, days: daysText(days), noDays: !days.length, hoursPerClass, classes, hours, amount: Math.round(hours * (Number(rate) || 0)), startsLate };
}

export const tutorStudents = (ctx, tid) => ctx.students.filter((s) => s.tutorId === tid && (s.status || "Active") === "Active");
export const payoutFor = (ctx, tid, type, key) => (ctx.tutorPayouts || []).find((p) => p.tutorId === tid && p.periodType === type && p.periodKey === key);

// Weekly payouts already made inside a month (so the monthly salary is not paid twice)
function weeklyPaidInMonth(ctx, tid, mk) {
  return (ctx.tutorPayouts || []).filter((p) => p.tutorId === tid && p.periodType === "week" && String(p.periodKey).slice(0, 7) === mk)
    .reduce((a, p) => a + (Number(p.net) || 0), 0);
}

export function tutorGross(ctx, t, type, key) {
  const lines = tutorStudents(ctx, t.id).map((s) => salaryLine(s, t.fee, type, key));
  return { lines, gross: lines.reduce((a, l) => a + l.amount, 0), hours: lines.reduce((a, l) => a + l.hours, 0) };
}

const payPill = (p) => !p ? `<span class="pill p-lost">Not paid</span>` : p.status === "Paid" ? `<span class="pill p-paid">Paid</span>` : `<span class="pill p-due">Pending</span>`;

// ───────────────────────── Tutor salary modal ─────────────────────────
export function openTutorFinance(ctx, tutor, startType = "month", startKey) {
  let t = tutor;
  const S = { type: startType, key: startKey || currentPeriod(startType), edits: {}, leaveDays: 0, leaveHrs: null, deduction: null, adjust: 0, adjustNote: "", payMode: "UPI", reference: "", paidOn: todayISO() };

  const m = modal({
    title: "Tutor salary",
    wide: true,
    body: `
      <div class="tp-top">
        <div><b class="tp-name">${esc(t.name)}</b><span class="sub">${esc(fmtPhone(t.phone))}${t.subjects ? " · " + esc(t.subjects) : ""}</span></div>
        <div class="tp-rate">
          <div class="fld"><label for="tpRate">Salary per hour (₹)</label><input id="tpRate" type="number" min="0" step="10" value="${esc(t.fee)}"></div>
          <div class="fld"><label for="tpUpi">Tutor UPI ID</label><input id="tpUpi" placeholder="name@okaxis" value="${esc(t.upi || "")}"></div>
          <button class="btn btn-ghost btn-sm" id="tpSaveTutor" type="button" hidden>Save</button>
        </div>
      </div>
      <div class="tp-period">
        <div class="seg" role="group" aria-label="Salary period">
          <button type="button" data-type="month">Monthly</button><button type="button" data-type="week">Weekly</button>
        </div>
        <div class="fld"><label for="tpKey" class="sr">Period</label><select id="tpKey"></select></div>
      </div>
      <div id="tpBody"></div>
      <div id="tpHist"></div>`,
    actions: [{ label: "Close", kind: "btn-navy" }]
  });
  const root = m.root;
  const unsub = ctx.subscribe((k) => { if (k === "tutorPayouts" || k === "students") { renderBody(); renderHist(); } });
  new MutationObserver((_, obs) => { if (!document.body.contains(root)) { unsub(); obs.disconnect(); } }).observe(document.body, { childList: true });

  const rate = () => Number($("#tpRate", root).value) || 0;
  const rateChanged = () => String(rate()) !== String(Number(t.fee) || 0) || $("#tpUpi", root).value.trim() !== (t.upi || "");
  $("#tpRate", root).addEventListener("input", () => { $("#tpSaveTutor", root).hidden = !rateChanged(); recalc(); });
  $("#tpUpi", root).addEventListener("input", () => { $("#tpSaveTutor", root).hidden = !rateChanged(); });
  $("#tpSaveTutor", root).addEventListener("click", async () => {
    const patch = { id: t.id, fee: rate(), upi: $("#tpUpi", root).value.trim() };
    await put("tutors", patch);
    t = { ...t, ...patch };
    if (ctx.tutors) ctx.setTutors(ctx.tutors.map((x) => (x.id === t.id ? t : x)));
    $("#tpSaveTutor", root).hidden = true;
    toast("Tutor salary rate saved", "ok");
    renderBody();
  });

  function fillKeys() {
    $$(".seg button", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.type === S.type)));
    const keys = periodChoices(S.type);
    if (!keys.includes(S.key)) keys.unshift(S.key);
    $("#tpKey", root).innerHTML = keys.map((k) => `<option value="${esc(k)}" ${k === S.key ? "selected" : ""}>${esc(periodLabel(S.type, k))}${payoutFor(ctx, t.id, S.type, k) ? (payoutFor(ctx, t.id, S.type, k).status === "Paid" ? "  ✓ paid" : "  · pending") : ""}</option>`).join("");
  }
  $$(".seg button", root).forEach((b) => b.addEventListener("click", () => { S.type = b.dataset.type; S.key = currentPeriod(S.type); resetForm(); fillKeys(); renderBody(); }));
  $("#tpKey", root).addEventListener("change", (e) => { S.key = e.target.value; resetForm(); renderBody(); });

  function resetForm() {
    const p = payoutFor(ctx, t.id, S.type, S.key);
    S.leaveDays = p ? Number(p.leaveDays) || 0 : 0;
    S.leaveHrs = p && p.leaveHoursPerDay != null ? Number(p.leaveHoursPerDay) : null;
    S.deduction = p && p.leaveDeduction != null ? Number(p.leaveDeduction) : null;
    S.adjust = p ? Number(p.adjustment) || 0 : 0;
    S.adjustNote = p ? p.adjustNote || "" : "";
    S.payMode = p && p.payMode ? p.payMode : "UPI";
    S.reference = p ? p.reference || "" : "";
    S.paidOn = p && p.paidOn ? p.paidOn : todayISO();
  }

  function calc() {
    const studs = tutorStudents(ctx, t.id);
    const lines = studs.map((s) => salaryLine(s, rate(), S.type, S.key, S.edits[s.id]));
    const gross = lines.reduce((a, l) => a + l.amount, 0);
    const totHours = lines.reduce((a, l) => a + l.hours, 0);
    // hours lost per leave day: the tutor's teaching hours on an average class day
    const perDay = {};
    lines.forEach((l) => parseDays(l.days).forEach((d) => { perDay[d] = (perDay[d] || 0) + l.hoursPerClass; }));
    const dayVals = Object.values(perDay);
    const autoLeaveHrs = dayVals.length ? Math.round((dayVals.reduce((a, b) => a + b, 0) / dayVals.length) * 4) / 4 : 0;
    const leaveHrs = S.leaveHrs == null ? autoLeaveHrs : S.leaveHrs;
    const autoDed = Math.round((Number(S.leaveDays) || 0) * leaveHrs * rate());
    const deduction = S.deduction == null ? autoDed : S.deduction;
    const alreadyPaid = S.type === "month" ? weeklyPaidInMonth(ctx, t.id, S.key) : 0;
    const net = Math.max(0, Math.round(gross - deduction + (Number(S.adjust) || 0) - alreadyPaid));
    return { studs, lines, gross, totHours, leaveHrs, autoLeaveHrs, deduction, autoDed, alreadyPaid, net };
  }

  function renderBody() {
    if (!document.body.contains(root)) return;
    const box = $("#tpBody", root);
    const p = payoutFor(ctx, t.id, S.type, S.key);
    if (p && p.status === "Paid") { box.innerHTML = paidView(p); bindPaid(p); return; }
    const c = calc();
    const monthPaid = S.type === "week" ? payoutFor(ctx, t.id, "month", S.key.slice(0, 7)) : null;
    if (!c.studs.length && !p) {
      box.innerHTML = `<div class="note">No active students are allocated to ${esc(t.name)}. Allocate students from <a href="#/allocation">Student Allocation</a> and their classes will be counted here.</div>`;
      return;
    }
    box.innerHTML = `
      ${!rate() ? `<div class="note warn" style="margin-bottom:10px">Enter the tutor's <b>salary per hour</b> above to calculate the salary.</div>` : ""}
      ${monthPaid ? `<div class="note warn" style="margin-bottom:10px">${esc(monthLabel(S.key.slice(0, 7)))} is already ${monthPaid.status === "Paid" ? "paid" : "saved"} as a monthly salary (${inr(monthPaid.net)}). Paying weekly too would pay twice.</div>` : ""}
      <div class="table-wrap"><table class="t tp-lines">
        <thead><tr><th>Student</th><th>Class days</th><th class="num">Hrs / class</th><th class="num">Classes</th><th class="num">Hours</th><th class="num">Amount</th></tr></thead>
        <tbody>${c.lines.map((l, i) => {
          const s = c.studs[i];
          const e = S.edits[s.id] || {};
          return `<tr data-sid="${esc(s.id)}">
            <td><span class="strong">${esc(s.name)}</span><span class="sub">${esc(s.studentClass || "")}${s.schedule ? " · " + esc(s.schedule) : ""}</span>${l.startsLate ? `<span class="sub">Counted from ${esc(fmtDate(iso(l.startsLate)))}</span>` : ""}</td>
            <td><input class="tp-in" data-k="days" value="${esc(e.days != null ? e.days : l.days)}" placeholder="Mon, Wed, Fri" aria-label="Class days for ${esc(s.name)}"></td>
            <td class="num"><input class="tp-in num" data-k="hours" type="number" min="0" step="0.25" value="${esc(e.hours != null ? e.hours : l.hoursPerClass)}" aria-label="Hours per class for ${esc(s.name)}"></td>
            <td class="num" data-c="classes">${l.noDays ? `<span class="pill p-due">Set days</span>` : l.classes}</td>
            <td class="num" data-c="hours">${l.hours}</td>
            <td class="num strong" data-c="amount">${inr(l.amount)}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
      <div class="tp-save-row" id="tpSaveRow" hidden><span class="sub">Class days / hours changed.</span><button class="btn btn-ghost btn-sm" type="button" id="tpSaveTimes">Save class timings to students</button></div>
      <div class="tp-grid">
        <div class="tp-adj">
          <h3>Leave &amp; adjustments</h3>
          <div class="form-grid">
            <div class="fld"><label for="tpLeave">Leave days (tutor absent)</label><input id="tpLeave" type="number" min="0" step="0.5" value="${esc(S.leaveDays || "")}" placeholder="0"></div>
            <div class="fld"><label for="tpLeaveHrs">Hours lost per leave day</label><input id="tpLeaveHrs" type="number" min="0" step="0.25" value="${esc(S.leaveHrs == null ? c.autoLeaveHrs : S.leaveHrs)}"></div>
            <div class="fld"><label for="tpDed">Leave deduction (₹)</label><input id="tpDed" type="number" min="0" step="1" value="${esc(c.deduction || "")}" placeholder="0"></div>
            <div class="fld"><label for="tpAdj">Other adjustment (₹, + / −)</label><input id="tpAdj" type="number" step="1" value="${esc(S.adjust || "")}" placeholder="e.g. 200 or -150"></div>
            <div class="fld full"><label for="tpAdjNote">Note</label><input id="tpAdjNote" value="${esc(S.adjustNote)}" placeholder="e.g. Extra class on Sunday, travel allowance"></div>
          </div>
        </div>
        <div class="tp-sum" id="tpSum"></div>
      </div>
      <div class="tp-pay">
        <h3>Transfer &amp; payment status ${payPill(p)}</h3>
        <div class="form-grid">
          <div class="fld"><label for="tpMode">Paid by</label><select id="tpMode">${options(["UPI", "Bank transfer", "Cash", "Cheque"], S.payMode)}</select></div>
          <div class="fld"><label for="tpRef">UPI / transaction ref.</label><input id="tpRef" value="${esc(S.reference)}"></div>
          <div class="fld"><label for="tpDate">Paid on</label><input id="tpDate" type="date" value="${esc(S.paidOn)}"></div>
        </div>
        <div class="tp-actions" id="tpActions"></div>
      </div>`;
    bindEdit();
    renderSum();
  }

  function renderSum() {
    const c = calc();
    $("#tpSum", root).innerHTML = `
      <div class="tp-row"><span>Salary (${esc(c.totHours)} hrs × ${inr(rate())})</span><b>${inr(c.gross)}</b></div>
      <div class="tp-row minus"><span>Leave deduction${S.leaveDays ? ` (${esc(S.leaveDays)} day${Number(S.leaveDays) === 1 ? "" : "s"})` : ""}</span><b>− ${inr(c.deduction)}</b></div>
      ${Number(S.adjust) ? `<div class="tp-row"><span>Adjustment</span><b>${Number(S.adjust) > 0 ? "+" : "−"} ${inr(Math.abs(Number(S.adjust)))}</b></div>` : ""}
      ${c.alreadyPaid ? `<div class="tp-row minus"><span>Already paid weekly this month</span><b>− ${inr(c.alreadyPaid)}</b></div>` : ""}
      <div class="tp-row total"><span>Net payable</span><b>${inr(c.net)}</b></div>
      <span class="sub">${esc(periodLabel(S.type, S.key))}</span>`;
    const p = payoutFor(ctx, t.id, S.type, S.key);
    const upi = $("#tpUpi", root).value.trim();
    const upiLink = upi && c.net ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(t.name)}&am=${c.net}&cu=INR&tn=${encodeURIComponent("CF Academy salary " + periodLabel(S.type, S.key))}` : "";
    $("#tpActions", root).innerHTML = `
      ${upiLink ? `<a class="btn btn-ghost" href="${esc(upiLink)}">Open UPI app to transfer ${inr(c.net)}</a>` : ""}
      <button class="btn btn-ghost" type="button" data-save="Pending">${p ? "Update pending" : "Save as pending"}</button>
      <button class="btn btn-accent" type="button" data-save="Paid">Mark as paid · ${inr(c.net)}</button>
      ${p && ctx.isAdmin ? `<button class="btn btn-danger btn-sm" type="button" id="tpDelP">Delete</button>` : ""}`;
    $$("[data-save]", root).forEach((b) => b.addEventListener("click", () => savePayout(b.dataset.save, b)));
    $("#tpDelP", root) && $("#tpDelP", root).addEventListener("click", () => delPayout(p));
  }

  function bindEdit() {
    const box = $("#tpBody", root);
    $$(".tp-in", box).forEach((inp) => inp.addEventListener("input", () => {
      const sid = inp.closest("tr").dataset.sid;
      S.edits[sid] = { ...(S.edits[sid] || {}), [inp.dataset.k]: inp.value };
      const s = ctx.students.find((x) => x.id === sid);
      const l = salaryLine(s, rate(), S.type, S.key, S.edits[sid]);
      const tr = inp.closest("tr");
      $('[data-c="classes"]', tr).innerHTML = l.noDays ? `<span class="pill p-due">Set days</span>` : l.classes;
      $('[data-c="hours"]', tr).textContent = l.hours;
      $('[data-c="amount"]', tr).textContent = inr(l.amount);
      $("#tpSaveRow", root).hidden = false;
      if (S.leaveHrs == null) $("#tpLeaveHrs", root).value = calc().autoLeaveHrs;
      if (S.deduction == null) $("#tpDed", root).value = calc().autoDed || "";
      renderSum();
    }));
    $("#tpSaveTimes", root).addEventListener("click", async () => {
      const ids = Object.keys(S.edits);
      await Promise.all(ids.map((sid) => {
        const e = S.edits[sid]; const patch = { id: sid };
        if (e.days != null) patch.classDays = daysText(parseDays(e.days));
        if (e.hours != null) patch.classHours = Number(e.hours) || 0;
        return put("students", patch);
      }));
      S.edits = {};
      toast("Class timings saved", "ok");
    });
    const num = (id) => $(id, root).value === "" ? 0 : Number($(id, root).value);
    $("#tpLeave", root).addEventListener("input", () => { S.leaveDays = num("#tpLeave"); S.deduction = null; $("#tpDed", root).value = calc().autoDed || ""; renderSum(); });
    $("#tpLeaveHrs", root).addEventListener("input", () => { S.leaveHrs = num("#tpLeaveHrs"); S.deduction = null; $("#tpDed", root).value = calc().autoDed || ""; renderSum(); });
    $("#tpDed", root).addEventListener("input", () => { S.deduction = num("#tpDed"); renderSum(); });
    $("#tpAdj", root).addEventListener("input", () => { S.adjust = num("#tpAdj"); renderSum(); });
    $("#tpAdjNote", root).addEventListener("input", (e) => { S.adjustNote = e.target.value; });
    $("#tpMode", root).addEventListener("change", (e) => { S.payMode = e.target.value; });
    $("#tpRef", root).addEventListener("input", (e) => { S.reference = e.target.value; });
    $("#tpDate", root).addEventListener("change", (e) => { S.paidOn = e.target.value; });
  }

  async function savePayout(status, btn) {
    const c = calc();
    if (!c.lines.length) { toast("No students allocated to this tutor", "bad"); return; }
    if (status === "Paid" && !c.net && !(await confirmBox("Net payable is ₹ 0", "Mark this salary as paid with ₹ 0?", "Yes, mark paid", false))) return;
    btn.disabled = true;
    const p = payoutFor(ctx, t.id, S.type, S.key);
    const rec = {
      ...(p ? { id: p.id } : {}),
      tutorId: t.id, tutorName: t.name, tutorPhone: normPhone(t.phone), tutorUpi: $("#tpUpi", root).value.trim(),
      periodType: S.type, periodKey: S.key, periodLabel: periodLabel(S.type, S.key), rate: rate(),
      lines: c.lines.map(({ startsLate, noDays, ...l }) => l),
      totalHours: c.totHours, gross: c.gross, leaveDays: Number(S.leaveDays) || 0, leaveHoursPerDay: c.leaveHrs,
      leaveDeduction: c.deduction, adjustment: Number(S.adjust) || 0, adjustNote: S.adjustNote.trim(), alreadyPaid: c.alreadyPaid,
      net: c.net, status, payMode: S.payMode, reference: S.reference.trim(),
      paidOn: status === "Paid" ? S.paidOn || todayISO() : "", paidBy: status === "Paid" ? ctx.user.email : "", savedBy: ctx.user.email
    };
    try {
      await put("tutorPayouts", rec);
      toast(status === "Paid" ? `Salary marked paid · ${inr(c.net)}` : "Salary saved as pending", "ok");
      fillKeys();
    } catch (ex) { toast("Could not save: " + ex.message, "bad"); }
    finally { btn.disabled = false; }
  }

  async function delPayout(p) {
    if (!(await confirmBox("Delete salary record?", `Delete the ${esc(p.status.toLowerCase())} salary of <b>${esc(t.name)}</b> for ${esc(p.periodLabel)} (${inr(p.net)})?`, "Delete"))) return;
    await remove("tutorPayouts", p.id);
    resetForm(); fillKeys();
    toast("Salary record deleted");
  }

  function slipText(p) {
    return `Dear ${t.name}, your CF Academy salary for ${p.periodLabel} is ${inr(p.net).replace("₹ ", "Rs. ")}` +
      ` (${p.totalHours} hrs × Rs. ${p.rate}${p.leaveDeduction ? `, leave deduction Rs. ${p.leaveDeduction}` : ""}${p.adjustment ? `, adjustment Rs. ${p.adjustment}` : ""}${p.alreadyPaid ? `, paid weekly Rs. ${p.alreadyPaid}` : ""}).` +
      ` Paid by ${p.payMode}${p.reference ? " (Ref " + p.reference + ")" : ""} on ${fmtDate(p.paidOn)}. Thank you — ${SITE.name}`;
  }

  function paidView(p) {
    return `
      <div class="note ok" style="margin-bottom:12px"><b>Paid ${inr(p.net)}</b> on ${esc(fmtDate(p.paidOn))} by ${esc(p.payMode)}${p.reference ? " · Ref " + esc(p.reference) : ""}${p.paidBy ? ` · ${esc(p.paidBy)}` : ""}</div>
      <div class="table-wrap"><table class="t">
        <thead><tr><th>Student</th><th>Class days</th><th class="num">Hrs / class</th><th class="num">Classes</th><th class="num">Hours</th><th class="num">Amount</th></tr></thead>
        <tbody>${(p.lines || []).map((l) => `<tr><td>${esc(l.studentName)}</td><td>${esc(l.days || "—")}</td><td class="num">${esc(l.hoursPerClass)}</td><td class="num">${esc(l.classes)}</td><td class="num">${esc(l.hours)}</td><td class="num">${inr(l.amount)}</td></tr>`).join("")}</tbody>
      </table></div>
      <div class="tp-grid"><div>${p.adjustNote ? `<p class="sub">Note: ${esc(p.adjustNote)}</p>` : ""}</div>
        <div class="tp-sum">
          <div class="tp-row"><span>Salary (${esc(p.totalHours)} hrs × ${inr(p.rate)})</span><b>${inr(p.gross)}</b></div>
          <div class="tp-row minus"><span>Leave deduction${p.leaveDays ? ` (${esc(p.leaveDays)} day${p.leaveDays === 1 ? "" : "s"})` : ""}</span><b>− ${inr(p.leaveDeduction)}</b></div>
          ${p.adjustment ? `<div class="tp-row"><span>Adjustment</span><b>${p.adjustment > 0 ? "+" : "−"} ${inr(Math.abs(p.adjustment))}</b></div>` : ""}
          ${p.alreadyPaid ? `<div class="tp-row minus"><span>Already paid weekly</span><b>− ${inr(p.alreadyPaid)}</b></div>` : ""}
          <div class="tp-row total"><span>Net paid</span><b>${inr(p.net)}</b></div>
        </div></div>
      <div class="tp-actions">
        <a class="btn btn-wa" href="${esc(waLink(t.phone, slipText(p)))}" target="_blank" rel="noopener">${ICONS.wa}Send salary slip on WhatsApp</a>
        <button class="btn btn-ghost" type="button" id="tpUnpay">Mark as not paid</button>
        ${ctx.isAdmin ? `<button class="btn btn-danger btn-sm" type="button" id="tpDelP">Delete</button>` : ""}
      </div>`;
  }
  function bindPaid(p) {
    $("#tpUnpay", root).addEventListener("click", async () => {
      if (!(await confirmBox("Mark as not paid?", `Change ${esc(t.name)}'s salary for ${esc(p.periodLabel)} back to <b>Pending</b>?`, "Mark pending", false))) return;
      await put("tutorPayouts", { id: p.id, status: "Pending", paidOn: "", paidBy: "" });
      toast("Salary set back to pending");
    });
    $("#tpDelP", root) && $("#tpDelP", root).addEventListener("click", () => delPayout(p));
  }

  function renderHist() {
    if (!document.body.contains(root)) return;
    const hist = (ctx.tutorPayouts || []).filter((p) => p.tutorId === t.id).sort((a, b) => String(b.periodKey).localeCompare(String(a.periodKey)));
    const paidTotal = hist.filter((p) => p.status === "Paid").reduce((a, p) => a + (Number(p.net) || 0), 0);
    $("#tpHist", root).innerHTML = hist.length ? `
      <h3 class="tp-h">Salary history <span class="sub" style="display:inline">· ${inr(paidTotal)} paid in total</span></h3>
      <div class="table-wrap"><table class="t"><thead><tr><th>Period</th><th class="num">Hours</th><th class="num">Leave</th><th class="num">Net</th><th>Status</th><th>Paid on</th></tr></thead>
      <tbody>${hist.slice(0, 24).map((p) => `<tr class="clickable" data-pt="${esc(p.periodType)}" data-pk="${esc(p.periodKey)}"><td>${esc(p.periodLabel)}<span class="sub">${p.periodType === "week" ? "Weekly" : "Monthly"}</span></td><td class="num">${esc(p.totalHours)}</td><td class="num">${p.leaveDays ? esc(p.leaveDays) + " d" : "—"}</td><td class="num strong">${inr(p.net)}</td><td>${payPill(p)}</td><td>${esc(fmtDate(p.paidOn) || "—")}<span class="sub">${esc(p.payMode && p.status === "Paid" ? p.payMode : "")}</span></td></tr>`).join("")}</tbody></table></div>` : "";
    $$("tr[data-pt]", $("#tpHist", root)).forEach((tr) => tr.addEventListener("click", () => {
      S.type = tr.dataset.pt; S.key = tr.dataset.pk; resetForm(); fillKeys(); renderBody();
      $("#tpBody", root).scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  resetForm(); fillKeys(); renderBody(); renderHist();
}

// ───────────────────────── Salary sheet (all tutors) ─────────────────────────
export function openSalarySheet(ctx) {
  const S = { type: "month", key: monthKey(), status: "" };
  const m = modal({
    title: "Tutor salary sheet",
    wide: true,
    body: `
      <div class="tp-period">
        <div class="seg" role="group" aria-label="Salary period"><button type="button" data-type="month">Monthly</button><button type="button" data-type="week">Weekly</button></div>
        <div class="fld"><select id="ssKey" aria-label="Period"></select></div>
        <div class="fld"><select id="ssStatus" aria-label="Status">${options(["Not paid", "Pending", "Paid"], "", "All tutors")}</select></div>
        <button class="btn btn-ghost btn-sm" type="button" id="ssExport">${ICONS.download}Export</button>
      </div>
      <div class="stats" id="ssStats"></div>
      <div id="ssList"></div>`,
    actions: [{ label: "Close", kind: "btn-navy" }]
  });
  const root = m.root;
  const unsub = ctx.subscribe((k) => { if (["tutorPayouts", "students", "tutors"].includes(k)) draw(); });
  new MutationObserver((_, obs) => { if (!document.body.contains(root)) { unsub(); obs.disconnect(); } }).observe(document.body, { childList: true });

  function fill() {
    $$(".seg button", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.type === S.type)));
    $("#ssKey", root).innerHTML = periodChoices(S.type).map((k) => `<option value="${esc(k)}" ${k === S.key ? "selected" : ""}>${esc(periodLabel(S.type, k))}</option>`).join("");
  }
  function rows() {
    const ids = new Set(ctx.students.filter((s) => (s.status || "Active") === "Active" && s.tutorId).map((s) => s.tutorId));
    (ctx.tutorPayouts || []).filter((p) => p.periodType === S.type && p.periodKey === S.key).forEach((p) => ids.add(p.tutorId));
    return [...ids].map((id) => {
      const t = (ctx.tutors || []).find((x) => x.id === id) || { id, name: (ctx.students.find((s) => s.tutorId === id) || {}).tutorName || "Tutor", phone: "", fee: 0 };
      const p = payoutFor(ctx, id, S.type, S.key);
      const g = tutorGross(ctx, t, S.type, S.key);
      return { t, p, students: tutorStudents(ctx, id).length, hours: p ? p.totalHours : g.hours, amount: p ? p.net : g.gross, status: p ? p.status : "Not paid" };
    }).sort((a, b) => String(a.t.name).localeCompare(String(b.t.name)));
  }
  function draw() {
    if (!document.body.contains(root)) return;
    const all = rows();
    const list = all.filter((r) => !S.status || r.status === S.status);
    const sum = (arr) => arr.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const paid = all.filter((r) => r.status === "Paid");
    const unpaid = all.filter((r) => r.status !== "Paid");
    $("#ssStats", root).innerHTML = `
      <div class="stat"><span>Tutors with students</span><b>${all.length}</b></div>
      <div class="stat good"><span>Paid</span><b>${inr(sum(paid))}</b></div>
      <div class="stat ${unpaid.length ? "warn" : ""}"><span>To pay (${unpaid.length} tutors)</span><b>${inr(sum(unpaid))}</b></div>`;
    $("#ssList", root).innerHTML = list.length ? `
      <div class="table-wrap"><table class="t"><thead><tr><th>Tutor</th><th class="num">Students</th><th class="num">Hours</th><th class="num">Rate / hr</th><th class="num">Salary</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map((r) => `<tr>
        <td><span class="strong">${esc(r.t.name)}</span><span class="sub">${esc(fmtPhone(r.t.phone))}</span></td>
        <td class="num">${r.students}</td><td class="num">${esc(r.hours)}</td>
        <td class="num">${r.t.fee ? inr(r.t.fee) : `<span class="pill p-due">Not set</span>`}</td>
        <td class="num strong">${inr(r.amount)}</td><td>${payPill(r.p)}</td>
        <td><button class="btn btn-ghost btn-sm" type="button" data-open="${esc(r.t.id)}">Open</button></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="panel empty">${all.length ? "No tutors match." : "No students are allocated to tutors yet."}</div>`;
    $$("[data-open]", root).forEach((b) => b.addEventListener("click", () => {
      const r = all.find((x) => x.t.id === b.dataset.open);
      openTutorFinance(ctx, r.t, S.type, S.key);
    }));
  }
  $$(".seg button", root).forEach((b) => b.addEventListener("click", () => { S.type = b.dataset.type; S.key = currentPeriod(S.type); fill(); draw(); }));
  $("#ssKey", root).addEventListener("change", (e) => { S.key = e.target.value; draw(); });
  $("#ssStatus", root).addEventListener("change", (e) => { S.status = e.target.value; draw(); });
  $("#ssExport", root).addEventListener("click", () => exportXlsx({
    Salaries: rows().map((r) => ({
      Tutor: r.t.name, Mobile: r.t.phone, "UPI ID": r.t.upi || "", Students: r.students, Hours: r.hours, "Rate per hour": Number(r.t.fee) || 0,
      "Leave days": r.p ? r.p.leaveDays || 0 : 0, "Leave deduction": r.p ? r.p.leaveDeduction || 0 : 0, Adjustment: r.p ? r.p.adjustment || 0 : 0,
      "Net salary": r.amount, Status: r.status, "Paid on": r.p ? r.p.paidOn || "" : "", "Paid by": r.p ? r.p.payMode || "" : "", Reference: r.p ? r.p.reference || "" : ""
    }))
  }, `CF-Academy-Tutor-Salaries-${S.key}.xlsx`));
  fill(); draw();
  if (ctx.tutors == null) ctx.ensureTutors().catch(() => {});
}
