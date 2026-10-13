// Fees — month view: who paid, who is due, WhatsApp reminders
import { SITE } from "../site-config.js";
import { $, $$, esc, fmtPhone, fmtDate, inr, waLink, options, exportXlsx, monthKey, monthLabel, lastMonths, ICONS } from "./ui.js";
import { feeFor, feePill } from "./common.js";

const st = { month: monthKey(), status: "", q: "" };
let root, ctx;

function studentsFor(mk) {
  // active students who had joined by the end of that month
  const end = mk + "-31";
  return ctx.students.filter((s) => (s.status || "Active") === "Active" && (!s.joinDate || s.joinDate <= end));
}

function render(view, c) {
  root = view; ctx = c;
  const months = lastMonths(12).reverse();
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Fees</h1><p>Monthly fee status for every active student.</p></div>
      <div class="actions">
        <div class="fld" style="min-width:190px"><label for="fMonth">Month</label><select id="fMonth">${months.map((m) => `<option value="${m}" ${m === st.month ? "selected" : ""}>${esc(monthLabel(m))}</option>`).join("")}</select></div>
        <button class="btn btn-ghost" id="fExport" style="align-self:flex-end">${ICONS.download}Export</button>
        <a class="btn btn-navy" href="#/receipts" style="align-self:flex-end">${ICONS.plus}Record payment</a>
      </div>
    </div>
    <div class="stats" id="fStats"></div>
    <div class="filters">
      <div class="fld grow"><label for="fQ">Search</label><input id="fQ" placeholder="Student, parent, mobile" value="${esc(st.q)}"></div>
      <div class="fld"><label for="fStatus">Status</label><select id="fStatus">${options(["Due", "Partial", "Paid"], st.status, "All")}</select></div>
    </div>
    <div id="fList"></div>`;
  $("#fMonth", view).addEventListener("change", (e) => { st.month = e.target.value; renderAll(); });
  $("#fStatus", view).addEventListener("change", (e) => { st.status = e.target.value; renderAll(); });
  $("#fQ", view).addEventListener("input", (e) => { st.q = e.target.value.trim().toLowerCase(); renderAll(); });
  $("#fExport", view).addEventListener("click", exportFees);
  renderAll();
}

function computed() {
  return studentsFor(st.month).map((s) => ({ s, f: feeFor(s, ctx.payments, st.month) }));
}

function reminderText(s, f) {
  return `Dear ${s.parentName || "Parent"}, this is a gentle reminder from ${SITE.name}. ${s.name}'s tuition fee for ${monthLabel(st.month)} is ${inr(f.balance).replace("₹ ", "Rs. ")}${f.paid ? " (balance)" : ""}. You can pay by UPI or cash. Please ignore if already paid. Thank you!`;
}

function renderAll() {
  if (!root) return;
  const rows = computed();
  const expected = rows.reduce((a, r) => a + r.f.fee, 0);
  const collected = rows.reduce((a, r) => a + Math.min(r.f.paid, r.f.fee || r.f.paid), 0);
  const due = rows.filter((r) => r.f.status === "Due" || r.f.status === "Partial");
  const dueAmt = due.reduce((a, r) => a + r.f.balance, 0);
  $("#fStats", root).innerHTML = `
    <div class="stat"><span>Expected · ${esc(monthLabel(st.month))}</span><b>${inr(expected)}</b></div>
    <div class="stat good"><span>Collected</span><b>${inr(collected)}</b></div>
    <div class="stat ${dueAmt ? "warn" : ""}"><span>Pending</span><b>${inr(dueAmt)}</b></div>
    <div class="stat"><span>Students pending</span><b>${due.length} / ${rows.length}</b></div>`;

  const list = rows.filter(({ s, f }) => (!st.status || f.status === st.status) &&
    (!st.q || [s.name, s.parentName, s.phone].join(" ").toLowerCase().includes(st.q)))
    .sort((a, b) => ({ Due: 0, Partial: 1, Paid: 2 }[a.f.status] ?? 3) - ({ Due: 0, Partial: 1, Paid: 2 }[b.f.status] ?? 3));

  $("#fList", root).innerHTML = !ctx.loaded.students || !ctx.loaded.payments ? `<div class="panel empty">Loading…</div>` : list.length ? `
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Student</th><th>Tutor</th><th class="num">Fee</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(({ s, f }) => `
        <tr>
          <td><span class="strong">${esc(s.name)}</span><span class="sub">${esc(s.parentName)} · ${esc(fmtPhone(s.phone))}</span></td>
          <td>${esc(s.tutorName || "—")}<span class="sub">${esc(s.studentClass || "")}</span></td>
          <td class="num">${inr(f.fee)}</td>
          <td class="num">${inr(f.paid)}</td>
          <td class="num strong">${inr(f.balance)}</td>
          <td>${feePill(f.status)}</td>
          <td style="white-space:nowrap">
            ${f.balance > 0 ? `<a class="btn btn-wa btn-sm" href="${esc(waLink(s.phone, reminderText(s, f)))}" target="_blank" rel="noopener">${ICONS.wa}Remind</a>
            <a class="btn btn-accent btn-sm" href="#/receipts?student=${esc(s.id)}">Mark paid</a>` : `<span class="sub">—</span>`}
          </td>
        </tr>`).join("")}</tbody></table></div>` : `<div class="panel empty">${rows.length ? "No students match." : "No active students for this month yet."}</div>`;
}

function exportFees() {
  exportXlsx({
    [monthLabel(st.month)]: computed().map(({ s, f }) => ({
      "Student": s.name, "Parent": s.parentName, "Mobile": s.phone, "Class": s.studentClass, "Tutor": s.tutorName || "",
      "Fee": f.fee, "Paid": f.paid, "Balance": f.balance, "Status": f.status
    }))
  }, `CF-Academy-Fees-${st.month}.xlsx`);
}

function refresh() { renderAll(); }
export default { deps: ["students", "payments"], render, refresh };
