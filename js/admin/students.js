// Students — converted bookings with tutor, schedule and monthly fee
import { put, remove } from "../db.js";
import { SITE, CLASSES, BOARDS, CITIES } from "../site-config.js";
import { $, $$, esc, fmtPhone, fmtDate, normPhone, inr, waLink, toast, modal, confirmBox, readFields, options, exportXlsx, debounce, todayISO, monthKey, monthLabel, ICONS } from "./ui.js";
import { feeFor, feePill, feeDue, feeDuePill, dueDateFor, dueDay } from "./common.js";

const st = { q: "", status: "Active", tutor: "", fee: "" };
let root, ctx, openedParam = null;

function rows() {
  const mk = monthKey();
  const q = st.q.toLowerCase();
  return ctx.students.filter((s) => {
    if (st.status && (s.status || "Active") !== st.status) return false;
    if (st.tutor === "none" && s.tutorId) return false;
    if (q && ![s.name, s.parentName, s.phone, s.subjects, s.tutorName, s.area].join(" ").toLowerCase().includes(q)) return false;
    if (st.fee) {
      const d = feeDue(s, ctx.payments);
      const ok = { "Paid": d.kind === "paid", "Due in 3 days": d.kind === "soon" || d.kind === "today", "Overdue": d.kind === "late",
        "Not due yet": d.kind === "upcoming", "Partly paid": d.status === "Partial" }[st.fee];
      if (!ok) return false;
    }
    return true;
  });
}

function render(view, c, params) {
  root = view; ctx = c;
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Students</h1><p>Converted leads with their tutor, schedule and monthly fee.</p></div>
      <div class="actions">
        <button class="btn btn-ghost" id="sExport">${ICONS.download}Export to Excel</button>
        <button class="btn btn-navy" id="sAdd">${ICONS.plus}Add student</button>
      </div>
    </div>
    <div class="stats" id="sStats"></div>
    <div class="filters">
      <div class="fld grow"><label for="sQ">Search</label><input id="sQ" placeholder="Student, parent, mobile, tutor" value="${esc(st.q)}"></div>
      <div class="fld"><label for="sStatus">Status</label><select id="sStatus">${options(["Active", "Inactive"], st.status, "All")}</select></div>
      <div class="fld"><label for="sTutor">Tutor</label><select id="sTutor"><option value="">Any</option><option value="none" ${st.tutor === "none" ? "selected" : ""}>Not assigned</option></select></div>
      <div class="fld"><label for="sFee">${esc(monthLabel(monthKey()))} fee</label><select id="sFee">${options(["Paid", "Due in 3 days", "Overdue", "Not due yet", "Partly paid"], st.fee, "All")}</select></div>
    </div>
    <div id="sList"></div>`;
  $("#sQ", view).addEventListener("input", debounce((e) => { st.q = e.target.value.trim(); renderList(); }, 200));
  $("#sStatus", view).addEventListener("change", (e) => { st.status = e.target.value; renderList(); });
  $("#sTutor", view).addEventListener("change", (e) => { st.tutor = e.target.value; renderList(); });
  $("#sFee", view).addEventListener("change", (e) => { st.fee = e.target.value; renderList(); });
  $("#sAdd", view).addEventListener("click", () => editStudent(null));
  $("#sExport", view).addEventListener("click", exportStudents);
  $("#sList", view).addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const s = ctx.students.find((x) => x.id === b.dataset.id); if (!s) return;
    if (b.dataset.act === "view") viewStudent(s);
    if (b.dataset.act === "edit") editStudent(s);
    if (b.dataset.act === "fees") feeCard(s);
  });
  renderList();
  if (params && params.fee) { st.fee = params.fee; $("#sFee", view).value = st.fee; renderList(); }
  if (params && params.id && openedParam !== params.id) {
    openedParam = params.id;
    const s = ctx.students.find((x) => x.id === params.id);
    if (s) viewStudent(s);
  }
  if (ctx.tutors == null) ctx.ensureTutors().catch(() => {});
}

function renderStats() {
  const act = ctx.students.filter((s) => (s.status || "Active") === "Active");
  const home = act.filter((s) => s.mode !== "Online tuition").length;
  const mk = monthKey();
  const joined = ctx.students.filter((s) => (s.joinDate || "").slice(0, 7) === mk).length;
  const noTutor = act.filter((s) => !s.tutorId).length;
  const dues = act.map((s) => feeDue(s, ctx.payments));
  const soon = dues.filter((d) => d.kind === "soon" || d.kind === "today").length;
  const late = dues.filter((d) => d.kind === "late").length;
  $("#sStats", root).innerHTML = `
    <div class="stat"><span>Active students</span><b>${act.length}</b></div>
    <div class="stat"><span>Home tuition</span><b>${home}</b></div>
    <div class="stat"><span>Online tuition</span><b>${act.length - home}</b></div>
    <div class="stat"><span>Joined this month</span><b>${joined}</b></div>
    <div class="stat ${noTutor ? "warn" : ""}"><span>Without a tutor</span><b>${noTutor}</b></div>
    <div class="stat ${soon ? "warn" : ""}"><span>Fee due in 3 days</span><b>${soon}</b></div>
    <div class="stat ${late ? "bad" : ""}"><span>Fee overdue</span><b>${late}</b></div>`;
}

function renderList() {
  if (!root) return;
  renderStats();
  if (!ctx.loaded.students) { $("#sList", root).innerHTML = `<div class="panel empty">Loading students…</div>`; return; }
  const mk = monthKey();
  const list = rows();
  $("#sList", root).innerHTML = list.length ? `
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Student</th><th>Class · subjects</th><th>Tutor · type</th><th>Schedule</th><th class="num">Fee / month</th><th>${esc(monthLabel(mk).split(" ")[0])} fee</th><th></th></tr></thead>
      <tbody>${list.map((s) => {
        const d = feeDue(s, ctx.payments);
        return `<tr>
          <td><span class="strong">${esc(s.name)}</span><span class="sub">${esc(s.parentName)} · ${esc(fmtPhone(s.phone))}</span></td>
          <td>${esc(s.studentClass)}${s.board ? " · " + esc(s.board) : ""}<span class="sub">${esc(s.subjects)}</span></td>
          <td>${s.tutorName ? esc(s.tutorName) : `<a class="pill p-due" href="#/allocation?student=${esc(s.id)}" style="text-decoration:none">Allocate tutor</a>`}<span class="sub">${esc(s.mode === "Online tuition" ? "Online" : "Home")} · ${esc([s.area, s.city].filter(Boolean).join(", "))}</span></td>
          <td>${esc(s.schedule || "—")}</td>
          <td class="num">${inr(s.monthlyFee)}</td>
          <td>${(s.status || "Active") === "Active" ? `<div class="fee-cell">${feeIcon(s, d)}<span>${feeDuePill(d)}${d.status === "Partial" ? `<span class="sub">Bal ${inr(d.balance)}</span>` : ""}${d.prevDue ? `<span class="sub" style="color:var(--err)">+ ${inr(d.prevDue)} last month</span>` : ""}</span></div>` : '<span class="pill p-lost">Inactive</span>'}</td>
          <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-act="view" data-id="${esc(s.id)}">View</button> <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${esc(s.id)}">Edit</button></td>
        </tr>`;
      }).join("")}</tbody></table></div>` : `<div class="panel empty">${ctx.students.length ? "No students match these filters." : "No students yet. Convert a booking from Bookings / Leads, or add a student here."}</div>`;
}

const ordinal = (n) => n + ([, "st", "nd", "rd"][(n % 100 >> 3 ^ 1) && n % 10] || "th");

// ₹ icon on every student row → month-wise fee card
function feeIcon(s, d) {
  const cls = { paid: "fin-paid", soon: "fin-soon", today: "fin-late", late: "fin-late" }[d.kind] || "";
  return `<button class="icon-btn ${cls}" data-act="fees" data-id="${esc(s.id)}" title="${esc(d.label)} · fee details" aria-label="Fees for ${esc(s.name)}: ${esc(d.label)}">${ICONS.fees}</button>`;
}

function reminderText(s, d) {
  const due = d.due.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
  const amt = inr(d.balance + d.prevDue).replace("₹ ", "Rs. ");
  return d.kind === "late"
    ? `Dear ${s.parentName || "Parent"}, ${s.name}'s tuition fee of ${amt} was due on ${due}. Kindly pay at the earliest by UPI or cash. Please ignore if already paid. Thank you — ${SITE.name}`
    : `Dear ${s.parentName || "Parent"}, a gentle reminder from ${SITE.name}: ${s.name}'s tuition fee of ${amt} is due on ${due}. You can pay by UPI or cash. Thank you!`;
}

function feeCard(s) {
  const now = new Date();
  const d = feeDue(s, ctx.payments, now);
  const j = s.joinDate ? new Date(s.joinDate + "T00:00") : null;
  const months = [];
  for (let i = 5; i >= -1; i--) {
    const x = new Date(now.getFullYear(), now.getMonth() - i, 1);
    if (j && new Date(x.getFullYear(), x.getMonth() + 1, 0) < j) continue;
    months.push(monthKey(x));
  }
  const curMk = monthKey(now);
  const rows = months.map((mk) => {
    const f = feeFor(s, ctx.payments, mk);
    const due = dueDateFor(s, mk);
    const future = mk > curMk;
    const pill = future ? `<span class="pill p-lost">Upcoming</span>` : mk === curMk ? feeDuePill(d) : feePill(f.status === "Due" ? "Overdue" : f.status);
    return `<tr${mk === curMk ? ' class="sel"' : ""}><td><span class="strong">${esc(monthLabel(mk))}</span></td><td>${esc(fmtDate(due))}</td><td class="num">${inr(f.fee)}</td><td class="num">${inr(f.paid)}</td><td class="num strong">${inr(future ? f.fee - f.paid : f.balance)}</td><td>${pill}</td></tr>`;
  }).join("");
  const unpaid = d.kind !== "paid" && d.kind !== "none" && d.kind !== "upcoming" || d.prevDue;
  modal({
    title: "Fees · " + s.name,
    wide: true,
    body: `
      <div class="stats">
        <div class="stat"><span>Monthly fee</span><b>${inr(s.monthlyFee)}</b></div>
        <div class="stat"><span>Due every month on</span><b>${esc(ordinal(dueDay(s)))}</b></div>
        <div class="stat ${d.kind === "late" || d.kind === "today" ? "bad" : d.kind === "soon" ? "warn" : d.kind === "paid" ? "good" : ""}"><span>${esc(monthLabel(curMk))}</span><b style="font-size:18px;margin-top:6px">${feeDuePill(d)}</b></div>
      </div>
      ${d.kind === "soon" || d.kind === "today" ? `<div class="note warn" style="margin-bottom:12px">Fee is due on <b>${esc(fmtDate(d.due))}</b> — send a reminder to the parent.</div>` : ""}
      ${d.kind === "late" ? `<div class="note bad" style="margin-bottom:12px">Fee was due on <b>${esc(fmtDate(d.due))}</b> and is not paid yet (balance ${inr(d.balance)}).</div>` : ""}
      ${d.prevDue ? `<div class="note bad" style="margin-bottom:12px">Last month also has an unpaid balance of <b>${inr(d.prevDue)}</b>.</div>` : ""}
      <div class="table-wrap"><table class="t">
        <thead><tr><th>Month</th><th>Due date</th><th class="num">Fee</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="sub">No months yet.</td></tr>`}</tbody>
      </table></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;align-items:flex-end">
        <div class="fld" style="width:170px"><label for="fcDay">Fee due day (1–31)</label><input id="fcDay" type="number" min="1" max="31" value="${esc(s.feeDueDay || "")}" placeholder="${esc(String(dueDay(s)))}"></div>
        <button class="btn btn-ghost btn-sm" type="button" id="fcSaveDay" style="margin-bottom:4px">Save due day</button>
        <span style="flex:1"></span>
        ${unpaid ? `<a class="btn btn-wa" href="${esc(waLink(s.phone, reminderText(s, d)))}" target="_blank" rel="noopener">${ICONS.wa}Send reminder</a>` : ""}
        <a class="btn btn-accent" href="#/receipts?student=${esc(s.id)}">${ICONS.plus}Record payment</a>
      </div>`,
    actions: [{ label: "Close", kind: "btn-navy" }],
    onOpen: (m, close) => {
      $$('a[href^="#/receipts"]', m).forEach((a) => a.addEventListener("click", () => close()));
      $("#fcSaveDay", m).addEventListener("click", async () => {
        const v = $("#fcDay", m).value;
        const n = v === "" ? "" : Math.round(Number(v));
        if (n !== "" && !(n >= 1 && n <= 31)) { toast("Enter a day between 1 and 31", "bad"); return; }
        await put("students", { id: s.id, feeDueDay: n });
        toast("Fee due day saved", "ok");
        close();
        const fresh = ctx.students.find((x) => x.id === s.id);
        if (fresh) feeCard(fresh);
      });
    }
  });
}

function tutorPicker(current) {
  const list = (ctx.tutors || []).filter((t) => (t.status || "Active") === "Active");
  return `<input name="tutorPick" list="tutorList" value="${esc(current ? `${current.tutorName || ""}${current.tutorPhone ? " · " + current.tutorPhone : ""}` : "")}" placeholder="Type tutor name or mobile">
    <datalist id="tutorList">${list.map((t) => `<option value="${esc(t.name + " · " + normPhone(t.phone))}">`).join("")}</datalist>`;
}
function resolveTutor(pick) {
  if (!pick) return { tutorId: "", tutorName: "", tutorPhone: "" };
  const ph = normPhone(pick.split("·").pop());
  const t = (ctx.tutors || []).find((x) => normPhone(x.phone) === ph) || (ctx.tutors || []).find((x) => x.name.toLowerCase() === pick.toLowerCase().trim());
  return t ? { tutorId: t.id, tutorName: t.name, tutorPhone: normPhone(t.phone) } : null;
}

function editStudent(s) {
  const v = s || { status: "Active", city: "Chennai", mode: "Home tuition", joinDate: todayISO() };
  modal({
    title: s ? "Edit student" : "Add student",
    body: `
      <div class="form-grid" id="stForm">
        <div class="fld"><label>Student name *</label><input name="name" value="${esc(v.name)}"></div>
        <div class="fld"><label>Parent name</label><input name="parentName" value="${esc(v.parentName)}"></div>
        <div class="fld"><label>Parent mobile *</label><input name="phone" inputmode="numeric" value="${esc(v.phone)}"></div>
        <div class="fld"><label>Email</label><input name="email" type="email" value="${esc(v.email)}"></div>
        <div class="fld"><label>Class</label><select name="studentClass">${options(CLASSES, v.studentClass, "—")}</select></div>
        <div class="fld"><label>Board</label><select name="board">${options(BOARDS, v.board, "—")}</select></div>
        <div class="fld full"><label>Subjects</label><input name="subjects" value="${esc(v.subjects)}"></div>
        <div class="fld"><label>Tuition type</label><select name="mode">${options(["Home tuition", "Online tuition"], v.mode)}</select></div>
        <div class="fld"><label>Schedule</label><input name="schedule" value="${esc(v.schedule)}" placeholder="Mon, Wed, Fri · 6 – 8 PM"></div>
        <div class="fld"><label>Area</label><input name="area" value="${esc(v.area)}"></div>
        <div class="fld"><label>City</label><select name="city">${options(CITIES, v.city, "—")}</select></div>
        <div class="fld full"><label>Address</label><input name="address" value="${esc(v.address)}"></div>
        <div class="fld full"><label>Tutor</label>${tutorPicker(s)}</div>
        <div class="fld"><label>Monthly fee (₹) *</label><input name="monthlyFee" type="number" min="0" step="50" value="${esc(v.monthlyFee)}"></div>
        <div class="fld"><label>Join date</label><input name="joinDate" type="date" value="${esc(v.joinDate)}"></div>
        <div class="fld"><label>Fee due day (1–31)</label><input name="feeDueDay" type="number" min="1" max="31" value="${esc(v.feeDueDay || "")}" placeholder="Same day as joining"></div>
        <div class="fld"><label>Hours per class</label><input name="classHours" type="number" min="0" step="0.25" value="${esc(v.classHours || "")}" placeholder="From schedule, e.g. 1"></div>
        <div class="fld"><label>Status</label><select name="status">${options(["Active", "Inactive"], v.status || "Active")}</select></div>
      </div>`,
    actions: [
      ...(s && ctx.isAdmin ? [{ label: "Delete", kind: "btn-danger", onClick: async () => {
        if (!(await confirmBox("Delete student?", `Delete <b>${esc(s.name)}</b>? Their receipts stay in Receipts. Usually it is better to mark the student Inactive.`, "Delete"))) return false;
        await remove("students", s.id); toast("Student deleted");
      } }] : []),
      { label: "Cancel" },
      {
        label: s ? "Save changes" : "Add student", kind: "btn-navy", onClick: async (close, m) => {
          const f = readFields($("#stForm", m));
          const pick = f.tutorPick; delete f.tutorPick;
          f.phone = normPhone(f.phone);
          if (!f.name || f.phone.length !== 10 || f.monthlyFee === "") { toast("Student name, 10-digit mobile and monthly fee are required", "bad"); return false; }
          const tut = resolveTutor(pick);
          if (!tut) { toast("Tutor not found — pick one from the list or leave it empty", "bad"); return false; }
          f.monthlyFee = Number(f.monthlyFee);
          if (f.feeDueDay !== "") { f.feeDueDay = Math.round(Number(f.feeDueDay)); if (!(f.feeDueDay >= 1 && f.feeDueDay <= 31)) { toast("Fee due day must be 1–31", "bad"); return false; } }
          if (f.classHours !== "") f.classHours = Number(f.classHours) || 0;
          if (tut.tutorId && (!s || s.tutorId !== tut.tutorId)) tut.allocatedOn = todayISO();
          // students added here (not converted from a booking) are counted as direct admissions in Reports
          await put("students", s ? { ...f, ...tut, id: s.id } : { ...f, ...tut, source: "Direct (admin)" });
          toast(s ? "Student updated" : "Student added", "ok");
        }
      }
    ]
  });
}

function viewStudent(s) {
  const pays = ctx.payments.filter((p) => p.studentId === s.id);
  const mk = monthKey();
  const f = feeFor(s, ctx.payments, mk);
  const total = pays.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  modal({
    title: s.name,
    wide: true,
    body: `
      <div class="stats">
        <div class="stat"><span>Monthly fee</span><b>${inr(s.monthlyFee)}</b></div>
        <div class="stat"><span>${esc(monthLabel(mk))}</span><b style="font-size:18px;margin-top:6px">${feePill(f.status)}</b></div>
        <div class="stat good"><span>Total paid</span><b>${inr(total)}</b></div>
      </div>
      <div class="grid2">
        <div class="panel"><h2>Details</h2>
          <div class="kv" style="display:grid;grid-template-columns:110px 1fr;gap:6px 10px;font-size:13px">
            <span class="sub">Parent</span><b style="font-weight:500">${esc(s.parentName)} · ${esc(fmtPhone(s.phone))}</b>
            <span class="sub">Class</span><b style="font-weight:500">${esc(s.studentClass)} ${s.board ? "· " + esc(s.board) : ""}</b>
            <span class="sub">Subjects</span><b style="font-weight:500">${esc(s.subjects)}</b>
            <span class="sub">Tuition</span><b style="font-weight:500">${esc(s.mode)}</b>
            <span class="sub">Location</span><b style="font-weight:500">${esc([s.address, s.area, s.city].filter(Boolean).join(", ") || "—")}</b>
            <span class="sub">Schedule</span><b style="font-weight:500">${esc(s.schedule || "—")}</b>
            <span class="sub">Tutor</span><b style="font-weight:500">${esc(s.tutorName || "Not assigned")}${s.tutorPhone ? " · " + esc(fmtPhone(s.tutorPhone)) : ""}</b>
            <span class="sub">Joined</span><b style="font-weight:500">${esc(fmtDate(s.joinDate))}</b>
            ${s.bookingNo ? `<span class="sub">Booking</span><b style="font-weight:500">${esc(s.bookingNo)}</b>` : ""}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            <a class="btn btn-ghost btn-sm" href="tel:+91${esc(normPhone(s.phone))}">${ICONS.phone}Call parent</a>
            <a class="btn btn-wa btn-sm" href="${esc(waLink(s.phone, `Hello ${s.parentName || ""}, this is CF Academy regarding ${s.name}'s tuition.`))}" target="_blank" rel="noopener">${ICONS.wa}WhatsApp</a>
            ${s.tutorPhone ? `<a class="btn btn-ghost btn-sm" href="tel:+91${esc(s.tutorPhone)}">${ICONS.phone}Call tutor</a>` : ""}
          </div>
        </div>
        <div class="panel"><div class="panel-head"><h2>Payments</h2><a class="btn btn-accent btn-sm" href="#/receipts?student=${esc(s.id)}">${ICONS.plus}Record payment</a></div>
          ${pays.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Receipt</th><th>For</th><th class="num">Amount</th></tr></thead><tbody>
            ${pays.map((p) => `<tr><td><a href="#/receipts?id=${esc(p.id)}">${esc(p.receiptNo)}</a><span class="sub">${esc(fmtDate(p.date))} · ${esc(p.payMode)}</span></td><td>${esc(p.monthsLabel)}</td><td class="num">${inr(p.amount)}</td></tr>`).join("")}
          </tbody></table></div>` : `<p class="sub">No payments recorded yet.</p>`}
        </div>
      </div>`,
    actions: [{ label: "Edit student", kind: "btn-ghost", onClick: () => { setTimeout(() => editStudent(s), 0); } }, { label: "Close", kind: "btn-navy" }]
  });
}

function exportStudents() {
  const mk = monthKey();
  exportXlsx({
    Students: rows().map((s) => {
      const f = feeFor(s, ctx.payments, mk);
      return {
        "Student": s.name, "Parent": s.parentName, "Mobile": s.phone, "Email": s.email || "", "Class": s.studentClass, "Board": s.board || "",
        "Subjects": s.subjects, "Tuition": s.mode, "Area": s.area || "", "City": s.city || "", "Address": s.address || "", "Schedule": s.schedule || "",
        "Tutor": s.tutorName || "", "Tutor mobile": s.tutorPhone || "", "Monthly fee": Number(s.monthlyFee) || 0,
        [`${monthLabel(mk)} status`]: f.status, "Join date": s.joinDate || "", "Status": s.status || "Active"
      };
    })
  }, `CF-Academy-Students-${todayISO()}.xlsx`);
}

function refresh() { renderList(); }
export default { deps: ["students", "payments", "tutors"], render, refresh };
