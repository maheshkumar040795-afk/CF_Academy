// Bookings / Leads — live list, call-back, tutor allocation, convert to student
import { put, remove, makeBookingNo } from "../db.js";
import { SUBJECTS, CLASSES, BOARDS, CITIES, TIME_SLOTS, BOOKING_STATUSES } from "../site-config.js";
import { $, $$, esc, fmtDateTime, fmtDate, fmtPhone, normPhone, waLink, toast, modal, confirmBox, readFields, options, exportXlsx, debounce, todayISO, ICONS } from "./ui.js";
import { statusPill, isOverdue, matchTutors } from "./common.js";

const PAGE = 50;
const st = { tab: "All", q: "", mode: "", city: "", page: 0, selected: null, tutorQ: "" };
let root, ctx;

const TABS = ["All", "Overdue", ...BOOKING_STATUSES];

function filtered() {
  const q = st.q.toLowerCase();
  return ctx.bookings.filter((b) => {
    if (st.tab === "Overdue" ? !isOverdue(b) : st.tab !== "All" && b.status !== st.tab) return false;
    if (st.mode && b.mode !== st.mode) return false;
    if (st.city && b.city !== st.city) return false;
    if (q) {
      const hay = [b.bookingNo, b.parentName, b.studentName, b.phone, b.subjects, b.area, b.city, b.tutorName].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function render(view, c, params) {
  root = view; ctx = c;
  if (params && params.id) st.selected = params.id;
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Bookings / Leads</h1><p>Website bookings arrive here live. Call the parent, assign a tutor, then convert to a student.</p></div>
      <div class="actions">
        <button class="btn btn-ghost" id="bExport">${ICONS.download}Export to Excel</button>
        <button class="btn btn-navy" id="bAdd">${ICONS.plus}Add phone / walk-in lead</button>
      </div>
    </div>
    <div class="tabs" id="bTabs"></div>
    <div class="filters">
      <div class="fld grow"><label for="bQ">Search</label><input id="bQ" placeholder="Name, phone, booking ID, subject, area" value="${esc(st.q)}"></div>
      <div class="fld"><label for="bMode">Tuition type</label><select id="bMode">${options(["Home tuition", "Online tuition"], st.mode, "All")}</select></div>
      <div class="fld"><label for="bCity">City</label><select id="bCity">${options(CITIES, st.city, "All cities")}</select></div>
    </div>
    <div class="split">
      <div><div id="bList"></div><div class="pager" id="bPager"></div></div>
      <div class="panel detail" id="bDetail"></div>
    </div>`;

  $("#bQ", view).addEventListener("input", debounce((e) => { st.q = e.target.value.trim(); st.page = 0; renderList(); }, 200));
  $("#bMode", view).addEventListener("change", (e) => { st.mode = e.target.value; st.page = 0; renderList(); });
  $("#bCity", view).addEventListener("change", (e) => { st.city = e.target.value; st.page = 0; renderList(); });
  $("#bTabs", view).addEventListener("click", (e) => {
    const t = e.target.closest(".tab"); if (!t) return;
    st.tab = t.dataset.t; st.page = 0; renderTabs(); renderList();
  });
  $("#bList", view).addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]"); if (!tr) return;
    st.selected = tr.dataset.id; st.tutorQ = "";
    renderList(); renderDetail();
    if (window.innerWidth < 1100) $("#bDetail", view).scrollIntoView({ behavior: "smooth" });
  });
  $("#bList", view).addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("tr[data-id]")) e.target.click();
  });
  // Assign / remove tutor (one delegated listener for the detail panel)
  $("#bDetail", view).addEventListener("click", async (e) => {
    const b = ctx.bookings.find((x) => x.id === st.selected);
    if (!b) return;
    const a = e.target.closest("[data-assign]");
    if (a) {
      const t = (ctx.tutors || []).find((x) => x.id === a.dataset.assign);
      if (!t) return;
      a.disabled = true;
      try {
        await put("bookings", {
          id: b.id, tutorId: t.id, tutorName: t.name, tutorPhone: normPhone(t.phone), tutorSubjects: t.subjects || "",
          status: ["New", "Called"].includes(b.status) ? "Tutor assigned" : b.status,
          claimedBy: b.claimedBy || ctx.user.email, claimedAt: b.claimedAt || Date.now()
        });
        if (b.studentId) await put("students", { id: b.studentId, tutorId: t.id, tutorName: t.name, tutorPhone: normPhone(t.phone) });
        st.tutorQ = "";
        toast(`${t.name} assigned`, "ok");
      } catch (ex) { toast(ex.message, "bad"); a.disabled = false; }
    }
    if (e.target.closest("[data-unassign]")) {
      await put("bookings", { id: b.id, tutorId: "", tutorName: "", tutorPhone: "", tutorSubjects: "" });
      toast("Tutor removed");
    }
  });
  $("#bExport", view).addEventListener("click", exportBookings);
  $("#bAdd", view).addEventListener("click", addLead);

  renderTabs(); renderList(); renderDetail();
  if (ctx.tutors == null) ctx.ensureTutors().catch(() => {});
}

function renderTabs() {
  const counts = {};
  ctx.bookings.forEach((b) => { counts[b.status || "New"] = (counts[b.status || "New"] || 0) + 1; });
  counts.All = ctx.bookings.length;
  counts.Overdue = ctx.bookings.filter(isOverdue).length;
  $("#bTabs", root).innerHTML = TABS.map((t) =>
    `<button class="tab" data-t="${esc(t)}" aria-pressed="${st.tab === t}" ${t === "Overdue" && counts.Overdue ? 'style="border-color:#B42318;color:' + (st.tab === t ? "#fff;background:#B42318" : "#B42318") + '"' : ""}>${esc(t)}<span class="c">${counts[t] || 0}</span></button>`
  ).join("");
}

function renderList() {
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  if (st.page >= pages) st.page = pages - 1;
  const slice = rows.slice(st.page * PAGE, st.page * PAGE + PAGE);
  if (!ctx.loaded.bookings) { $("#bList", root).innerHTML = `<div class="panel empty">Loading bookings…</div>`; return; }
  $("#bList", root).innerHTML = rows.length ? `
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Booking</th><th>Parent / student</th><th>Subject · class</th><th>Type · location</th><th>Tutor</th><th>Status</th></tr></thead>
      <tbody>${slice.map((b) => `
        <tr class="clickable ${b.id === st.selected ? "sel" : ""}" data-id="${esc(b.id)}" tabindex="0">
          <td><span class="strong">${esc(b.bookingNo || "—")}</span><span class="sub">${esc(fmtDateTime(b.createdAt))}</span></td>
          <td>${esc(b.parentName)}<span class="sub">${esc(b.studentName)} · ${esc(fmtPhone(b.phone))}</span></td>
          <td>${esc(b.subjects)}<span class="sub">${esc(b.studentClass)}${b.board ? " · " + esc(b.board) : ""}</span></td>
          <td>${esc(b.mode === "Online tuition" ? "Online" : "Home")}<span class="sub">${esc([b.area, b.city].filter(Boolean).join(", "))}</span></td>
          <td>${b.tutorName ? esc(b.tutorName) : '<span class="sub">Not assigned</span>'}</td>
          <td>${statusPill(b)}${b.claimedBy ? `<span class="sub">by ${esc(b.claimedBy.split("@")[0])}</span>` : ""}</td>
        </tr>`).join("")}
      </tbody></table></div>` : `<div class="panel empty">No bookings match these filters.</div>`;
  $("#bPager", root).innerHTML = rows.length > PAGE ? `
    <span>Showing ${st.page * PAGE + 1}–${Math.min(rows.length, (st.page + 1) * PAGE)} of ${rows.length}</span>
    <span class="btns"><button class="btn btn-ghost btn-sm" data-p="-1" ${st.page === 0 ? "disabled" : ""}>Previous</button><button class="btn btn-ghost btn-sm" data-p="1" ${st.page >= pages - 1 ? "disabled" : ""}>Next</button></span>` : rows.length ? `<span>${rows.length} booking${rows.length === 1 ? "" : "s"}</span>` : "";
  $$("[data-p]", $("#bPager", root)).forEach((b) => b.addEventListener("click", () => { st.page += Number(b.dataset.p); renderList(); }));
}

function parentWaText(b) {
  return `Hello ${b.parentName}, this is CF Academy. Thank you for booking a tutor for ${b.studentName} (${b.studentClass}, ${b.subjects}). Booking ID: ${b.bookingNo}. We will share the tutor details shortly.`;
}
function tutorWaText(b, t) {
  return `Hello ${t.name}, CF Academy here. New ${b.mode === "Online tuition" ? "online" : "home"} tuition requirement:\n` +
    `Student: ${b.studentClass}${b.board ? ", " + b.board : ""}\nSubjects: ${b.subjects}\n` +
    `Location: ${[b.area, b.city].filter(Boolean).join(", ")}\n` +
    (b.days ? `Days: ${b.days}\n` : "") + (b.time ? `Time: ${b.time}\n` : "") +
    `Are you available? Please reply. (Ref ${b.bookingNo})`;
}

function renderDetail() {
  const box = $("#bDetail", root);
  if (!box) return;
  const b = ctx.bookings.find((x) => x.id === st.selected);
  if (!b) {
    box.innerHTML = `<div class="empty" style="padding:40px 10px">Select a booking to see details, call the parent and assign a tutor.</div>`;
    return;
  }
  const tutorsReady = Array.isArray(ctx.tutors);
  const matches = tutorsReady ? matchTutors(b, ctx.tutors, 8) : [];
  const assigned = tutorsReady && b.tutorId ? ctx.tutors.find((t) => t.id === b.tutorId) : null;
  const manual = st.tutorQ && tutorsReady
    ? ctx.tutors.filter((t) => [t.name, t.phone, t.subjects, t.area].join(" ").toLowerCase().includes(st.tutorQ.toLowerCase())).slice(0, 8)
    : [];

  const tutorCard = (t, hits, isAssigned) => `
    <div class="match ${isAssigned ? "assigned" : ""}">
      <div class="who">
        <b>${esc(t.name)}</b> <span class="sub" style="display:inline;white-space:nowrap">· ${esc(fmtPhone(t.phone))}</span>
        <span class="sub">${esc(t.subjects)}${t.classes ? " · " + esc(t.classes) : ""}</span>
        <span class="sub">${esc([t.area, t.city].filter(Boolean).join(", "))}${t.experience ? " · " + esc(t.experience) + " yrs" : ""}${t.fee ? " · ₹" + esc(t.fee) + "/hr" : ""}</span>
        ${hits ? `<div class="tags">
          <span class="tag ${hits.subject ? "hit" : ""}">Subject</span>
          ${b.mode === "Online tuition" ? `<span class="tag ${hits.mode ? "hit" : ""}">Online</span>` : `<span class="tag ${hits.area ? "hit" : ""}">Area</span><span class="tag ${hits.city ? "hit" : ""}">City</span>`}
          ${hits.cls != null ? `<span class="tag ${hits.cls ? "hit" : ""}">Class</span>` : ""}
        </div>` : ""}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <a class="btn btn-ghost btn-sm" href="tel:+91${esc(normPhone(t.phone))}" aria-label="Call ${esc(t.name)}">${ICONS.phone}</a>
        <a class="btn btn-wa btn-sm" href="${esc(waLink(t.phone, tutorWaText(b, t)))}" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(t.name)}">${ICONS.wa}</a>
        ${isAssigned ? `<button class="btn btn-danger btn-sm" data-unassign>Remove</button>` : `<button class="btn btn-accent btn-sm" data-assign="${esc(t.id)}">Assign</button>`}
      </div>
    </div>`;

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
      <div>
        <span class="sub">${esc(b.bookingNo || "")} · ${esc(fmtDateTime(b.createdAt))} · ${esc(b.source === "website" ? "Website" : b.source || "Manual")}</span>
        <h2 style="margin:2px 0 0;font-size:19px;color:var(--navy)">${esc(b.parentName)}</h2>
        <span class="sub">Student: ${esc(b.studentName)}</span>
      </div>
      ${statusPill(b)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
      <a class="btn btn-navy" href="tel:+91${esc(normPhone(b.phone))}" data-claim>${ICONS.phone}Call ${esc(fmtPhone(b.phone))}</a>
      <a class="btn btn-wa" href="${esc(waLink(b.phone, parentWaText(b)))}" target="_blank" rel="noopener" data-claim>${ICONS.wa}WhatsApp</a>
    </div>
    ${b.claimedBy ? `<div class="claimed">Being handled by <b>${esc(b.claimedBy)}</b> · ${esc(fmtDateTime(b.claimedAt))}</div>` : ""}
    <div class="kv">
      <span>Tuition</span><b>${esc(b.mode)}</b>
      <span>Class</span><b>${esc(b.studentClass)}${b.board ? " · " + esc(b.board) : ""}</b>
      <span>Subjects</span><b>${esc(b.subjects)}</b>
      <span>Location</span><b>${esc([b.area, b.city].filter(Boolean).join(", ") || "—")}</b>
      ${b.address ? `<span>Address</span><b>${esc(b.address)}</b>` : ""}
      <span>Days · time</span><b>${esc([b.days, b.time].filter(Boolean).join(" · ") || "—")}</b>
      ${b.startDate ? `<span>Start from</span><b>${esc(fmtDate(b.startDate))}</b>` : ""}
      ${b.email ? `<span>Email</span><b>${esc(b.email)}</b>` : ""}
      ${b.notes ? `<span>Parent note</span><b>${esc(b.notes)}</b>` : ""}
    </div>

    <form id="bEdit">
      <div class="form-grid">
        <div class="fld"><label for="eStatus">Status</label><select id="eStatus" name="status">${options(BOOKING_STATUSES, b.status || "New")}</select></div>
        <div class="fld"><label for="eFollow">Follow-up date</label><input id="eFollow" name="followUp" type="date" value="${esc(b.followUp || "")}"></div>
        <div class="fld full"><label for="eNotes">Call notes</label><textarea id="eNotes" name="adminNotes" placeholder="What did the parent say?">${esc(b.adminNotes || "")}</textarea></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-navy" type="submit">Save</button>
        ${b.studentId ? `<a class="btn btn-ghost" href="#/students?id=${esc(b.studentId)}">View student</a>` : `<button class="btn btn-accent" type="button" id="bConvert">Convert to student</button>`}
      </div>
    </form>

    <h3>Assigned tutor</h3>
    ${b.tutorId ? tutorCard(assigned || { id: b.tutorId, name: b.tutorName, phone: b.tutorPhone, subjects: b.tutorSubjects || "" }, null, true) : `<p class="sub" style="margin:0">No tutor assigned yet.</p>`}

    <h3>Suggested tutors <span class="sub" style="display:inline;font-weight:400">· best match for subject${b.mode === "Online tuition" ? " + online" : " + area"}</span></h3>
    ${!tutorsReady ? `<p class="sub">Loading tutors…</p>` : ctx.tutors.length === 0 ? `<div class="note warn">No tutors yet. <a href="#/tutors">Import the tutor Excel</a> to get suggestions.</div>` :
      matches.length ? matches.filter((m) => m.t.id !== b.tutorId).map((m) => tutorCard(m.t, m.hits, false)).join("") : `<div class="note">No tutor matches the subject. Search all tutors below.</div>`}

    <div class="fld" style="margin-top:10px"><label for="tSearch">Search all ${tutorsReady ? ctx.tutors.length : ""} tutors</label><input id="tSearch" placeholder="Name, phone, subject or area" value="${esc(st.tutorQ)}"></div>
    <div id="tManual" style="margin-top:8px">${manual.map((t) => tutorCard(t, null, false)).join("")}</div>

    ${ctx.isAdmin ? `<div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line)"><button class="btn btn-danger btn-sm" id="bDelete">Delete booking</button></div>` : ""}`;

  // events
  $$("[data-claim]", box).forEach((a) => a.addEventListener("click", () => {
    if (!b.claimedBy) put("bookings", { id: b.id, claimedBy: ctx.user.email, claimedAt: Date.now() }).catch(() => {});
  }));
  $("#bEdit", box).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = readFields(e.target);
    const patch = { id: b.id, ...f };
    if (!b.claimedBy && f.status !== "New") { patch.claimedBy = ctx.user.email; patch.claimedAt = Date.now(); }
    try { await put("bookings", patch); toast("Booking saved", "ok"); } catch (ex) { toast(ex.message, "bad"); }
  });
  const ts = $("#tSearch", box);
  ts.addEventListener("input", debounce(() => {
    st.tutorQ = ts.value.trim();
    const list = st.tutorQ ? ctx.tutors.filter((t) => [t.name, t.phone, t.subjects, t.area, t.city].join(" ").toLowerCase().includes(st.tutorQ.toLowerCase())).slice(0, 8) : [];
    $("#tManual", box).innerHTML = list.length ? list.map((t) => tutorCard(t, null, false)).join("") : st.tutorQ ? `<p class="sub">No tutor found.</p>` : "";
  }, 200));
  const conv = $("#bConvert", box);
  conv && conv.addEventListener("click", () => convertToStudent(b));
  $("#bDelete", box) && $("#bDelete", box).addEventListener("click", async () => {
    if (!(await confirmBox("Delete booking?", `Delete booking <b>${esc(b.bookingNo)}</b> from ${esc(b.parentName)}? This cannot be undone.`, "Delete"))) return;
    await remove("bookings", b.id);
    st.selected = null;
    toast("Booking deleted");
  });
}

function convertToStudent(b) {
  modal({
    title: "Convert to student",
    body: `
      <div class="form-grid" id="cvForm">
        <div class="fld"><label>Student name</label><input name="name" value="${esc(b.studentName)}"></div>
        <div class="fld"><label>Parent name</label><input name="parentName" value="${esc(b.parentName)}"></div>
        <div class="fld"><label>Parent mobile</label><input name="phone" value="${esc(b.phone)}"></div>
        <div class="fld"><label>Class</label><select name="studentClass">${options(CLASSES, b.studentClass)}</select></div>
        <div class="fld"><label>Board</label><select name="board">${options(BOARDS, b.board, "—")}</select></div>
        <div class="fld"><label>Tuition type</label><select name="mode">${options(["Home tuition", "Online tuition"], b.mode)}</select></div>
        <div class="fld full"><label>Subjects</label><input name="subjects" value="${esc(b.subjects)}"></div>
        <div class="fld"><label>Area</label><input name="area" value="${esc(b.area)}"></div>
        <div class="fld"><label>City</label><select name="city">${options(CITIES, b.city, "—")}</select></div>
        <div class="fld full"><label>Schedule</label><input name="schedule" value="${esc([b.days, b.time].filter(Boolean).join(" · "))}"></div>
        <div class="fld"><label>Monthly fee (₹) *</label><input name="monthlyFee" type="number" min="0" step="50" required></div>
        <div class="fld"><label>Join date</label><input name="joinDate" type="date" value="${esc(todayISO())}"></div>
        <div class="fld full"><label>Tutor</label><input value="${esc(b.tutorName || "Not assigned yet — you can assign later")}" disabled></div>
      </div>`,
    actions: [
      { label: "Cancel" },
      {
        label: "Create student", kind: "btn-navy", onClick: async (close, m) => {
          const f = readFields($("#cvForm", m));
          if (!f.name || !f.monthlyFee) { toast("Enter student name and monthly fee", "bad"); return false; }
          const sid = await put("students", {
            ...f, monthlyFee: Number(f.monthlyFee), phone: normPhone(f.phone), status: "Active",
            tutorId: b.tutorId || "", tutorName: b.tutorName || "", tutorPhone: b.tutorPhone || "",
            bookingId: b.id, bookingNo: b.bookingNo || "", email: b.email || "", address: b.address || ""
          });
          await put("bookings", { id: b.id, status: "Converted", studentId: sid });
          toast(`${f.name} added to students`, "ok");
        }
      }
    ]
  });
}

function addLead() {
  modal({
    title: "Add phone / walk-in lead",
    body: `
      <div class="form-grid" id="alForm">
        <div class="fld"><label>Parent name *</label><input name="parentName"></div>
        <div class="fld"><label>Mobile *</label><input name="phone" inputmode="numeric"></div>
        <div class="fld"><label>Student name</label><input name="studentName"></div>
        <div class="fld"><label>Class</label><select name="studentClass">${options(CLASSES, "", "—")}</select></div>
        <div class="fld"><label>Board</label><select name="board">${options(BOARDS, "", "—")}</select></div>
        <div class="fld"><label>Tuition type</label><select name="mode">${options(["Home tuition", "Online tuition"], "Home tuition")}</select></div>
        <div class="fld full"><label>Subjects</label><input name="subjects" list="subjList" placeholder="e.g. Mathematics, Science"><datalist id="subjList">${SUBJECTS.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></div>
        <div class="fld"><label>Area</label><input name="area"></div>
        <div class="fld"><label>City</label><select name="city">${options(CITIES, "Chennai")}</select></div>
        <div class="fld"><label>Preferred days</label><input name="days" placeholder="Mon, Wed, Fri"></div>
        <div class="fld"><label>Preferred time</label><select name="time">${options(TIME_SLOTS, "", "—")}</select></div>
        <div class="fld full"><label>Notes</label><textarea name="notes"></textarea></div>
      </div>`,
    actions: [
      { label: "Cancel" },
      {
        label: "Save lead", kind: "btn-navy", onClick: async (close, m) => {
          const f = readFields($("#alForm", m));
          if (!f.parentName || normPhone(f.phone).length !== 10) { toast("Enter parent name and a 10-digit mobile", "bad"); return false; }
          const id = await put("bookings", { ...f, phone: normPhone(f.phone), bookingNo: makeBookingNo(), status: "New", source: "Phone / walk-in", claimedBy: ctx.user.email, claimedAt: Date.now() });
          st.selected = id;
          st.tab = "All";
          renderTabs(); renderList(); renderDetail();
          toast("Lead added", "ok");
        }
      }
    ]
  });
}

function exportBookings() {
  const rows = filtered().map((b) => ({
    "Booking ID": b.bookingNo, "Date": fmtDateTime(b.createdAt), "Status": b.status, "Parent": b.parentName, "Mobile": b.phone,
    "Email": b.email || "", "Student": b.studentName, "Class": b.studentClass, "Board": b.board || "", "Subjects": b.subjects,
    "Tuition": b.mode, "Area": b.area || "", "City": b.city || "", "Address": b.address || "", "Days": b.days || "", "Time": b.time || "",
    "Start date": b.startDate || "", "Parent notes": b.notes || "", "Tutor": b.tutorName || "", "Tutor mobile": b.tutorPhone || "",
    "Handled by": b.claimedBy || "", "Follow-up": b.followUp || "", "Call notes": b.adminNotes || "", "Source": b.source || ""
  }));
  exportXlsx({ Bookings: rows }, `CF-Academy-Bookings-${todayISO()}.xlsx`);
}

function refresh(key) {
  if (!root || !document.body.contains(root)) return;
  if (key === "bookings") { renderTabs(); renderList(); }
  const box = $("#bDetail", root);
  const editing = box && box.contains(document.activeElement) && document.activeElement.matches("input, textarea, select");
  if (!editing) renderDetail();
}

export default { deps: ["bookings", "tutors"], render, refresh };
