// Receipts — record a fee payment and generate a numbered, printable receipt
import { put, remove, nextReceiptNo } from "../db.js";
import { SITE } from "../site-config.js";
import { $, $$, esc, fmtDate, fmtPhone, inr, waLink, toast, confirmBox, options, exportXlsx, debounce, todayISO, monthKey, monthLabel, amountInWords, ICONS } from "./ui.js";
import { feeFor } from "./common.js";

const st = { q: "", shownId: null, studentId: "" };
let root, ctx;

function monthChoices() {
  const out = [];
  const d = new Date();
  for (let i = -6; i <= 6; i++) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() + i, 1)));
  return out;
}
function monthsFrom(start, n) {
  const [y, m] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => monthKey(new Date(y, m - 1 + i, 1)));
}
function monthsLabel(keys) {
  if (keys.length === 1) return monthLabel(keys[0]);
  return monthLabel(keys[0]).split(" ")[0] + " – " + monthLabel(keys[keys.length - 1]);
}

function render(view, c, params) {
  root = view; ctx = c;
  if (params && params.student) st.studentId = params.student;
  if (params && params.id) st.shownId = params.id;
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Fee receipts</h1><p>Record a payment — a numbered receipt is created that you can print, save as PDF or send on WhatsApp.</p></div>
      <div class="actions"><button class="btn btn-ghost" id="rExport">${ICONS.download}Export receipts</button></div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:20px;align-items:start" class="rc-grid">
      <form class="panel" id="payForm" autocomplete="off">
        <h2>Record fee payment</h2>
        <div class="fld" style="margin-bottom:10px"><label for="pStudent">Student *</label><select id="pStudent" name="studentId"></select></div>
        <div class="note" id="pInfo" style="margin-bottom:10px">Choose a student to see the fee details.</div>
        <div class="form-grid">
          <div class="fld"><label for="pFrom">From month</label><select id="pFrom">${options(monthChoices().map(monthLabel), monthLabel(monthKey()))}</select></div>
          <div class="fld"><label for="pCount">Months</label><select id="pCount">${options([1, 2, 3, 4, 5, 6, 12], 1)}</select></div>
          <div class="fld"><label for="pAmount">Amount (₹) *</label><input id="pAmount" type="number" min="1" step="1"></div>
          <div class="fld"><label for="pMode">Paid by</label><select id="pMode">${options(["UPI", "Cash", "Bank transfer", "Cheque"], "UPI")}</select></div>
          <div class="fld"><label for="pRef">UPI / reference no.</label><input id="pRef"></div>
          <div class="fld"><label for="pDate">Date</label><input id="pDate" type="date" value="${todayISO()}"></div>
          <div class="fld full"><label for="pNote">Note on receipt (optional)</label><input id="pNote" placeholder="e.g. Includes exam material"></div>
        </div>
        <button class="btn btn-navy btn-block" style="margin-top:14px;min-height:46px" type="submit" id="pSave">Save &amp; generate receipt</button>
      </form>
      <div id="rPreview"></div>
    </div>
    <div class="panel" style="margin-top:20px">
      <div class="panel-head"><h2>All receipts</h2><div class="fld" style="min-width:240px"><input id="rQ" placeholder="Search receipt no, student, parent" aria-label="Search receipts" value="${esc(st.q)}"></div></div>
      <div id="rList"></div>
    </div>`;
  // stack on small screens
  const mq = window.matchMedia("(max-width: 1000px)");
  const grid = $(".rc-grid", view);
  const applyMq = () => { grid.style.gridTemplateColumns = mq.matches ? "1fr" : "minmax(300px,380px) minmax(0,1fr)"; };
  applyMq(); mq.addEventListener ? mq.addEventListener("change", applyMq) : null;

  fillStudents();
  $("#pStudent", view).addEventListener("change", () => { st.studentId = $("#pStudent", view).value; updateInfo(true); });
  $("#pFrom", view).addEventListener("change", () => updateInfo(true));
  $("#pCount", view).addEventListener("change", () => updateInfo(true));
  $("#payForm", view).addEventListener("submit", savePayment);
  $("#rQ", view).addEventListener("input", debounce((e) => { st.q = e.target.value.trim(); renderList(); }, 200));
  $("#rList", view).addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) { const p = ctx.payments.find((x) => x.id === del.dataset.del); if (p) deleteReceipt(p); return; }
    const pdf = e.target.closest("[data-pdf]");
    if (pdf) { const p = ctx.payments.find((x) => x.id === pdf.dataset.pdf); if (p) downloadPdf(p, pdf); return; }
    const sh = e.target.closest("[data-share]");
    if (sh) { const p = ctx.payments.find((x) => x.id === sh.dataset.share); if (p) shareWhatsApp(p, sh); return; }
    const tr = e.target.closest("tr[data-id]"); if (!tr) return;
    st.shownId = tr.dataset.id; renderPreview(); renderList();
    $("#rPreview", root).scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#rExport", view).addEventListener("click", exportReceipts);
  updateInfo(true);
  renderPreview();
  renderList();
}

function fillStudents() {
  const sel = $("#pStudent", root);
  const list = ctx.students.filter((s) => (s.status || "Active") === "Active" || s.id === st.studentId)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  sel.innerHTML = `<option value="">Choose student</option>` + list.map((s) =>
    `<option value="${esc(s.id)}" ${s.id === st.studentId ? "selected" : ""}>${esc(s.name)} · ${esc(s.studentClass || "")} · ${esc(fmtPhone(s.phone))}</option>`).join("");
}

function selectedMonths() {
  const labels = monthChoices().map(monthLabel);
  const idx = labels.indexOf($("#pFrom", root).value);
  const start = monthChoices()[idx < 0 ? 6 : idx];
  return monthsFrom(start, Number($("#pCount", root).value) || 1);
}

function updateInfo(setAmount) {
  const s = ctx.students.find((x) => x.id === st.studentId);
  const info = $("#pInfo", root);
  if (!s) { info.textContent = "Choose a student to see the fee details."; info.className = "note"; return; }
  const keys = selectedMonths();
  const dues = keys.map((k) => feeFor(s, ctx.payments, k));
  const balance = dues.reduce((a, d) => a + d.balance, 0);
  const paidAny = dues.some((d) => d.paid > 0);
  info.className = "note " + (balance === 0 && Number(s.monthlyFee) ? "ok" : "");
  info.innerHTML = `Tutor: <b>${esc(s.tutorName || "Not assigned")}</b> · Monthly fee <b>${inr(s.monthlyFee)}</b><br>` +
    (balance === 0 && Number(s.monthlyFee) ? `${esc(monthsLabel(keys))} is already fully paid.` : `Balance for ${esc(monthsLabel(keys))}: <b>${inr(balance)}</b>${paidAny ? " (part paid earlier)" : ""}`);
  if (setAmount) $("#pAmount", root).value = balance || Number(s.monthlyFee) * keys.length || "";
}

async function savePayment(e) {
  e.preventDefault();
  const s = ctx.students.find((x) => x.id === $("#pStudent", root).value);
  const amount = Number($("#pAmount", root).value);
  if (!s) { toast("Choose a student", "bad"); return; }
  if (!amount || amount <= 0) { toast("Enter the amount received", "bad"); return; }
  const btn = $("#pSave", root);
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    const keys = selectedMonths();
    const date = $("#pDate", root).value || todayISO();
    const [y, m, d] = date.split("-").map(Number);
    const receiptNo = await nextReceiptNo(new Date(y, m - 1, d));
    const id = await put("payments", {
      receiptNo, date, amount, payMode: $("#pMode", root).value, reference: $("#pRef", root).value.trim(),
      note: $("#pNote", root).value.trim(), monthKeys: keys, monthsLabel: monthsLabel(keys),
      studentId: s.id, studentName: s.name, parentName: s.parentName || "", phone: s.phone || "",
      studentClass: s.studentClass || "", board: s.board || "", subjects: s.subjects || "", mode: s.mode || "",
      tutorName: s.tutorName || "", monthlyFee: Number(s.monthlyFee) || 0, collectedBy: ctx.user.email
    });
    st.shownId = id;
    $("#pRef", root).value = ""; $("#pNote", root).value = "";
    updateInfo(true); renderPreview(); renderList();
    toast(`Receipt ${receiptNo} created`, "ok");
  } catch (ex) {
    toast("Could not save: " + ex.message, "bad");
  } finally {
    btn.disabled = false; btn.textContent = "Save & generate receipt";
  }
}

export function receiptHTML(p) {
  const studentNow = ctx && ctx.students.find((s) => s.id === p.studentId);
  let balanceLine = "";
  if (studentNow && (p.monthKeys || []).length) {
    const bal = p.monthKeys.reduce((a, k) => a + feeFor(studentNow, ctx.payments, k).balance, 0);
    balanceLine = `Balance for ${esc(p.monthsLabel)}: <b style="color:${bal ? "var(--err)" : "var(--ok)"}">${inr(bal)}</b>`;
  }
  return `
  <div class="receipt print-area">
    <div class="rh">
      <div class="org"><img src="assets/logo-192.png" alt=""><div><b>${esc(SITE.name)}</b><small>${esc(SITE.fullName)} · ${esc(SITE.address)}<br>${SITE.phones.map(fmtPhone).map(esc).join(" · ")}${SITE.email ? " · " + esc(SITE.email) : ""}</small></div></div>
      <span class="title">FEE RECEIPT</span>
    </div>
    <div class="rb">
      <div class="meta">
        <span>Receipt no. <b>${esc(p.receiptNo)}</b></span>
        <span>Date <b>${esc(fmtDate(p.date))}</b></span>
        <span>Student <b>${esc(p.studentName)}</b></span>
        <span>Parent <b>${esc(p.parentName || "—")}</b></span>
        <span>Class <b>${esc(p.studentClass || "—")}${p.board ? " · " + esc(p.board) : ""}</b></span>
        <span>Tutor <b>${esc(p.tutorName || "—")}</b></span>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="amt">Amount</th></tr></thead>
        <tbody>
          <tr><td>Tuition fee — ${esc(p.subjects || "")} · ${esc(p.monthsLabel)}${p.mode ? " (" + esc(p.mode.toLowerCase()) + ")" : ""}${p.note ? `<br><span class="sub">${esc(p.note)}</span>` : ""}</td><td class="amt">${inr(p.amount)}</td></tr>
          <tr class="total"><td>Total received</td><td class="amt">${inr(p.amount)}</td></tr>
        </tbody>
      </table>
      <div class="words">In words: <b style="color:var(--ink);font-weight:500">Rupees ${esc(amountInWords(p.amount))} only</b></div>
      <div class="rf">
        <div>Paid by ${esc(p.payMode)}${p.reference ? " · Ref " + esc(p.reference) : ""}<br>${balanceLine}</div>
        <div class="sign"><div class="line"></div>Authorised signature</div>
      </div>
    </div>
    <div class="thanks">Thank you for choosing ${esc(SITE.name)}. This is a computer-generated receipt.</div>
  </div>`;
}

function renderPreview() {
  const box = $("#rPreview", root);
  const p = ctx.payments.find((x) => x.id === st.shownId);
  if (!p) {
    box.innerHTML = `<div class="panel empty" style="min-height:300px;display:grid;place-items:center">The receipt appears here after you save a payment, or pick one from the list below.</div>`;
    return;
  }
  const text = `Dear ${p.parentName || "Parent"}, we have received ${inr(p.amount).replace("₹ ", "Rs. ")} towards ${p.studentName}'s tuition fee for ${p.monthsLabel}. Receipt no: ${p.receiptNo}, dated ${fmtDate(p.date)}. Thank you — ${SITE.name}`;
  box.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-bottom:10px">
      <button class="btn btn-ghost" id="rPrint">${ICONS.print}Print / Save PDF</button>
      <button class="btn btn-ghost" type="button" id="rPdf">${ICONS.download}Download PDF</button>
      <button class="btn btn-wa" type="button" id="rShare">${ICONS.wa}Share PDF on WhatsApp</button>
      ${ctx.isAdmin ? `<button class="btn btn-danger" id="rDel">Delete</button>` : ""}
    </div>
    ${receiptHTML(p)}`;
  $("#rPrint", box).addEventListener("click", () => window.print());
  $("#rPdf", box).addEventListener("click", (e) => downloadPdf(p, e.currentTarget));
  $("#rShare", box).addEventListener("click", (e) => shareWhatsApp(p, e.currentTarget));
  $("#rDel", box) && $("#rDel", box).addEventListener("click", () => deleteReceipt(p));
}

// ── PDF receipt (html2canvas + jsPDF, loaded only when first needed) ──
const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];
let libsP = null;
function loadLibs() {
  if (!libsP) {
    libsP = Promise.all(LIBS.map((src) => new Promise((ok, bad) => {
      const sc = document.createElement("script");
      sc.src = src; sc.async = true; sc.onload = ok;
      sc.onerror = () => { libsP = null; bad(new Error("Could not load the PDF tool — check the internet connection")); };
      document.head.appendChild(sc);
    })));
  }
  return libsP;
}
const pdfName = (p) => `CF-Academy-Receipt-${String(p.receiptNo).replace(/[^\w-]+/g, "-")}.pdf`;

async function makePdf(p) {
  await loadLibs();
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:760px;background:#fff;padding:0";
  host.innerHTML = receiptHTML(p);
  document.body.appendChild(host);
  try {
    await Promise.all([...host.querySelectorAll("img")].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
    const canvas = await window.html2canvas(host.firstElementChild, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pw = 210, margin = 12, w = pw - margin * 2;
    const h = (canvas.height * w) / canvas.width;
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, w, h);
    doc.setProperties({ title: `Fee receipt ${p.receiptNo}`, author: SITE.name });
    return doc.output("blob");
  } finally { host.remove(); }
}
function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function busy(btn, fn) {
  const old = btn && btn.innerHTML;
  if (btn) { btn.disabled = true; btn.style.opacity = ".6"; }
  try { await fn(); } catch (ex) { toast(ex.message || "Something went wrong", "bad"); }
  finally { if (btn) { btn.disabled = false; btn.style.opacity = ""; btn.innerHTML = old; } }
}
function downloadPdf(p, btn) {
  return busy(btn, async () => { saveBlob(await makePdf(p), pdfName(p)); toast("PDF downloaded", "ok"); });
}
function shareText(p) {
  return `Dear ${p.parentName || "Parent"}, we have received ${inr(p.amount).replace("₹ ", "Rs. ")} towards ${p.studentName}'s tuition fee for ${p.monthsLabel}.\n` +
    `Receipt no: ${p.receiptNo}\nDate: ${fmtDate(p.date)}\nPaid by: ${p.payMode}${p.reference ? " (Ref " + p.reference + ")" : ""}\n` +
    `Please find the fee receipt attached. Thank you — ${SITE.name}`;
}
// WhatsApp links cannot carry files, so: on phones (and Chrome/Edge on Windows & Mac) the
// share sheet sends the PDF + message — pick WhatsApp. Elsewhere the PDF downloads and
// WhatsApp opens with the message, ready for the PDF to be attached.
function shareWhatsApp(p, btn) {
  return busy(btn, async () => {
    const blob = await makePdf(p);
    const file = new File([blob], pdfName(p), { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: shareText(p), title: `Fee receipt ${p.receiptNo}` });
        return;
      } catch (ex) { if (ex && ex.name === "AbortError") return; }
    }
    saveBlob(blob, pdfName(p));
    window.open(waLink(p.phone, shareText(p)), "_blank", "noopener");
    toast("PDF downloaded — in WhatsApp, tap 📎 and attach it, then Send.", "ok");
  });
}

async function deleteReceipt(p) {
  if (!ctx.isAdmin) { toast("Only an Owner or Admin login can delete receipts.", "bad"); return; }
  if (!(await confirmBox("Delete receipt?", `Delete receipt <b>${esc(p.receiptNo)}</b> for ${esc(p.studentName)} (${inr(p.amount)}, ${esc(p.monthsLabel)})? The fee will show as unpaid again. The receipt number is not reused.`, "Delete receipt"))) return;
  try {
    await remove("payments", p.id);
    if (st.shownId === p.id) st.shownId = null;
    toast(`Receipt ${p.receiptNo} deleted`);
  } catch (ex) { toast("Could not delete: " + ex.message, "bad"); }
}

function renderList() {
  const q = st.q.toLowerCase();
  const list = ctx.payments.filter((p) => !q || [p.receiptNo, p.studentName, p.parentName, p.phone, p.reference].join(" ").toLowerCase().includes(q));
  $("#rList", root).innerHTML = !ctx.loaded.payments ? `<div class="empty">Loading…</div>` : list.length ? `
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Receipt</th><th>Student</th><th>For</th><th>Paid by</th><th class="num">Amount</th><th></th></tr></thead>
      <tbody>${list.slice(0, 300).map((p) => `
        <tr class="clickable ${p.id === st.shownId ? "sel" : ""}" data-id="${esc(p.id)}">
          <td><span class="strong">${esc(p.receiptNo)}</span><span class="sub">${esc(fmtDate(p.date))}</span></td>
          <td>${esc(p.studentName)}<span class="sub">${esc(p.parentName)}</span></td>
          <td>${esc(p.monthsLabel)}</td>
          <td>${esc(p.payMode)}<span class="sub">${esc(p.reference || "")}</span></td>
          <td class="num strong">${inr(p.amount)}</td>
          <td class="rc-acts">
            <button class="btn btn-ghost btn-sm" type="button" data-pdf="${esc(p.id)}" title="Download PDF" aria-label="Download PDF of receipt ${esc(p.receiptNo)}">${ICONS.download}PDF</button>
            <button class="icon-btn wa-btn" type="button" data-share="${esc(p.id)}" title="Share PDF on WhatsApp" aria-label="Share receipt ${esc(p.receiptNo)} on WhatsApp">${ICONS.wa}</button>
            ${ctx.isAdmin ? `<button class="btn btn-danger btn-sm" type="button" data-del="${esc(p.id)}" aria-label="Delete receipt ${esc(p.receiptNo)}">Delete</button>` : ""}
          </td>
        </tr>`).join("")}</tbody></table></div>
      ${list.length > 300 ? `<p class="sub">Showing latest 300 of ${list.length}. Search to find older receipts.</p>` : ""}` : `<div class="empty">No receipts yet.</div>`;
}

function exportReceipts() {
  exportXlsx({
    Receipts: ctx.payments.map((p) => ({
      "Receipt no": p.receiptNo, "Date": p.date, "Student": p.studentName, "Parent": p.parentName, "Mobile": p.phone,
      "Class": p.studentClass, "Subjects": p.subjects, "Tutor": p.tutorName, "For": p.monthsLabel,
      "Amount": Number(p.amount) || 0, "Paid by": p.payMode, "Reference": p.reference || "", "Collected by": p.collectedBy || ""
    }))
  }, `CF-Academy-Receipts-${todayISO()}.xlsx`);
}

function refresh(key) {
  if (!root || !document.body.contains(root)) return;
  if (key === "students") { fillStudents(); updateInfo(false); }
  if (key === "payments") { updateInfo(false); renderPreview(); renderList(); }
}

export default { deps: ["students", "payments"], render, refresh };
