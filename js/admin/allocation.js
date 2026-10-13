// Student Allocation — match each student to a tutor by subject, class and location
import { put } from "../db.js";
import { SUBJECTS, CITIES, SITE } from "../site-config.js";
import { $, $$, esc, fmtPhone, fmtDate, normPhone, waLink, toast, options, debounce, todayISO, exportXlsx, ICONS } from "./ui.js";
import { matchTutors, canonSubjects } from "./common.js";

const st = { view: "students", tab: "Needs tutor", q: "", subject: "", city: "", selected: null, tutorQ: "", tq: "" };
let root, ctx;

const active = () => ctx.students.filter((s) => (s.status || "Active") === "Active");
function workload() {
  const m = {};
  active().forEach((s) => { if (s.tutorId) m[s.tutorId] = (m[s.tutorId] || 0) + 1; });
  return m;
}

function filteredStudents() {
  const q = st.q.toLowerCase();
  const subj = st.subject ? [...canonSubjects(st.subject)][0] : "";
  return active().filter((s) => {
    if (st.tab === "Needs tutor" && s.tutorId) return false;
    if (st.tab === "Allocated" && !s.tutorId) return false;
    if (st.city && s.city !== st.city) return false;
    if (subj && !canonSubjects(s.subjects).has(subj)) return false;
    if (q && ![s.name, s.parentName, s.phone, s.subjects, s.area, s.tutorName].join(" ").toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (a.tutorId ? 1 : 0) - (b.tutorId ? 1 : 0) || String(a.name).localeCompare(String(b.name)));
}

function render(view, c, params) {
  root = view; ctx = c;
  if (params && params.student) { st.selected = params.student; st.tab = "All active"; st.view = "students"; }
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Student Allocation</h1><p>Allocate each student to the best-matched tutor by subject, class and location — or change the tutor.</p></div>
      <div class="actions">
        <div class="tabs" style="margin:0" role="group" aria-label="View">
          <button class="tab" data-view="students" aria-pressed="${st.view === "students"}">By student</button>
          <button class="tab" data-view="tutors" aria-pressed="${st.view === "tutors"}">By tutor</button>
        </div>
        <button class="btn btn-ghost" id="aExport">${ICONS.download}Export allocation</button>
      </div>
    </div>
    <div class="stats" id="aStats"></div>
    <div id="aBody"></div>`;
  $$("[data-view]", view).forEach((b) => b.addEventListener("click", () => {
    st.view = b.dataset.view;
    $$("[data-view]", view).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderBody();
  }));
  $("#aExport", view).addEventListener("click", exportAllocation);
  renderStats();
  renderBody();
  if (ctx.tutors == null) ctx.ensureTutors().catch((e) => toast("Could not load tutors: " + e.message, "bad"));
}

function renderStats() {
  const act = active();
  const none = act.filter((s) => !s.tutorId).length;
  const w = workload();
  const busy = Object.keys(w).length;
  const avail = (ctx.tutors || []).filter((t) => (t.status || "Active") === "Active").length;
  $("#aStats", root).innerHTML = `
    <div class="stat"><span>Active students</span><b>${act.length}</b></div>
    <div class="stat ${none ? "warn" : "good"}"><span>Waiting for a tutor</span><b>${none}</b></div>
    <div class="stat"><span>Tutors teaching now</span><b>${busy}</b></div>
    <div class="stat"><span>Active tutors available</span><b>${ctx.tutors ? avail : "…"}</b></div>`;
}

function renderBody() {
  if (st.view === "tutors") return renderByTutor();
  const body = $("#aBody", root);
  body.innerHTML = `
    <div class="tabs" id="aTabs">${["Needs tutor", "Allocated", "All active"].map((t) => `<button class="tab" data-t="${t}" aria-pressed="${st.tab === t}">${t}</button>`).join("")}</div>
    <div class="filters">
      <div class="fld grow"><label for="aQ">Search</label><input id="aQ" placeholder="Student, parent, mobile, tutor" value="${esc(st.q)}"></div>
      <div class="fld"><label for="aSubj">Subject</label><select id="aSubj">${options(SUBJECTS.filter((s) => s !== "All Subjects"), st.subject, "All subjects")}</select></div>
      <div class="fld"><label for="aCity">City</label><select id="aCity">${options(CITIES, st.city, "All cities")}</select></div>
    </div>
    <div class="split">
      <div id="aList"></div>
      <div class="panel detail" id="aDetail"></div>
    </div>`;
  $("#aTabs", body).addEventListener("click", (e) => {
    const t = e.target.closest(".tab"); if (!t) return;
    st.tab = t.dataset.t;
    $$("#aTabs .tab", body).forEach((x) => x.setAttribute("aria-pressed", String(x === t)));
    renderList();
  });
  $("#aQ", body).addEventListener("input", debounce((e) => { st.q = e.target.value.trim(); renderList(); }, 200));
  $("#aSubj", body).addEventListener("change", (e) => { st.subject = e.target.value; renderList(); });
  $("#aCity", body).addEventListener("change", (e) => { st.city = e.target.value; renderList(); });
  $("#aList", body).addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]"); if (!tr) return;
    st.selected = tr.dataset.id; st.tutorQ = "";
    renderList(); renderDetail();
    if (window.innerWidth < 1100) $("#aDetail", root).scrollIntoView({ behavior: "smooth" });
  });
  $("#aDetail", body).addEventListener("click", onDetailClick);
  renderList();
  renderDetail();
}

function renderList() {
  const box = $("#aList", root);
  if (!box) return;
  if (!ctx.loaded.students) { box.innerHTML = `<div class="panel empty">Loading students…</div>`; return; }
  const list = filteredStudents();
  box.innerHTML = list.length ? `
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Student</th><th>Class · subjects</th><th>Type · location</th><th>Tutor</th></tr></thead>
      <tbody>${list.slice(0, 300).map((s) => `
        <tr class="clickable ${s.id === st.selected ? "sel" : ""}" data-id="${esc(s.id)}" tabindex="0">
          <td><span class="strong">${esc(s.name)}</span><span class="sub">${esc(s.parentName || "")} · ${esc(fmtPhone(s.phone))}</span></td>
          <td>${esc(s.studentClass || "")}${s.board ? " · " + esc(s.board) : ""}<span class="sub">${esc(s.subjects)}</span></td>
          <td>${esc(s.mode === "Online tuition" ? "Online" : "Home")}<span class="sub">${esc([s.area, s.city].filter(Boolean).join(", "))}</span></td>
          <td>${s.tutorName ? `${esc(s.tutorName)}<span class="sub">since ${esc(fmtDate(s.allocatedOn || s.joinDate))}</span>` : '<span class="pill p-due">Needs tutor</span>'}</td>
        </tr>`).join("")}</tbody></table></div>
      ${list.length > 300 ? `<p class="sub">Showing 300 of ${list.length} — search to narrow down.</p>` : ""}` :
    `<div class="panel empty">${active().length ? (st.tab === "Needs tutor" ? "Every active student has a tutor." : "No students match.") : "No students yet. Convert a booking or add a student first."}</div>`;
}

function tutorMsgFor(s) {
  return `Hello, CF Academy here. You are allocated a new ${s.mode === "Online tuition" ? "online" : "home"} tuition student:\n` +
    `Student: ${s.name} (${s.studentClass || ""}${s.board ? ", " + s.board : ""})\nSubjects: ${s.subjects}\n` +
    (s.mode === "Online tuition" ? "" : `Address: ${[s.address, s.area, s.city].filter(Boolean).join(", ")}\n`) +
    (s.schedule ? `Schedule: ${s.schedule}\n` : "") +
    `Parent: ${s.parentName || ""} · ${fmtPhone(s.phone)}\nPlease call the parent and confirm the first class.`;
}
function parentMsgFor(s, t) {
  return `Dear ${s.parentName || "Parent"}, ${SITE.name} has allocated ${t.name}${t.qualification ? " (" + t.qualification + ")" : ""} as ${s.name}'s tutor for ${s.subjects}. ` +
    `Tutor mobile: ${fmtPhone(t.phone)}. The tutor will contact you to fix the first class. Thank you!`;
}

function renderDetail() {
  const box = $("#aDetail", root);
  if (!box) return;
  const s = ctx.students.find((x) => x.id === st.selected);
  if (!s) { box.innerHTML = `<div class="empty" style="padding:40px 10px">Select a student to see matching tutors and allocate one.</div>`; return; }
  const ready = Array.isArray(ctx.tutors);
  const w = workload();
  const current = ready && s.tutorId ? ctx.tutors.find((t) => t.id === s.tutorId) || { id: s.tutorId, name: s.tutorName, phone: s.tutorPhone } : null;
  const matches = ready ? matchTutors(s, ctx.tutors, 10).filter((m) => m.t.id !== s.tutorId) : [];
  const manual = ready && st.tutorQ
    ? ctx.tutors.filter((t) => [t.name, t.phone, t.subjects, t.area, t.city].join(" ").toLowerCase().includes(st.tutorQ.toLowerCase())).slice(0, 8)
    : [];

  const card = (t, hits, isCurrent) => `
    <div class="match ${isCurrent ? "assigned" : ""}">
      <div class="who">
        <b>${esc(t.name)}</b> <span class="sub" style="display:inline;white-space:nowrap">· ${esc(fmtPhone(t.phone))}</span>
        <span class="sub">${esc(t.subjects || "")}${t.classes ? " · " + esc(t.classes) : ""}</span>
        <span class="sub">${esc([t.area, t.city].filter(Boolean).join(", "))}${t.experience ? " · " + esc(t.experience) + " yrs" : ""}${t.mode ? " · " + esc(t.mode) : ""}</span>
        <div class="tags">
          ${hits ? `<span class="tag ${hits.subject ? "hit" : ""}">Subject</span>
          ${s.mode === "Online tuition" ? `<span class="tag ${hits.mode ? "hit" : ""}">Online</span>` : `<span class="tag ${hits.area ? "hit" : ""}">Area</span><span class="tag ${hits.city ? "hit" : ""}">City</span>`}
          ${hits.cls != null ? `<span class="tag ${hits.cls ? "hit" : ""}">Class</span>` : ""}` : ""}
          <span class="tag">${w[t.id] || 0} student${(w[t.id] || 0) === 1 ? "" : "s"} now</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <a class="btn btn-ghost btn-sm" href="tel:+91${esc(normPhone(t.phone))}" aria-label="Call ${esc(t.name)}">${ICONS.phone}</a>
        <a class="btn btn-wa btn-sm" href="${esc(waLink(t.phone, tutorMsgFor(s)))}" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(t.name)} the student details">${ICONS.wa}</a>
        ${isCurrent ? `<button class="btn btn-danger btn-sm" data-unassign>Remove</button>` : `<button class="btn btn-accent btn-sm" data-assign="${esc(t.id)}">${s.tutorId ? "Change to" : "Allocate"}</button>`}
      </div>
    </div>`;

  const history = (s.allocationHistory || []).slice().reverse();
  box.innerHTML = `
    <span class="sub">${esc(s.studentClass || "")}${s.board ? " · " + esc(s.board) : ""} · ${esc(s.mode || "")}</span>
    <h2 style="margin:2px 0 0;font-size:19px;color:var(--navy)">${esc(s.name)}</h2>
    <span class="sub">Parent: ${esc(s.parentName || "—")} · ${esc(fmtPhone(s.phone))}</span>
    <div class="kv">
      <span>Subjects</span><b>${esc(s.subjects || "—")}</b>
      <span>Location</span><b>${esc([s.address, s.area, s.city].filter(Boolean).join(", ") || "—")}</b>
      <span>Schedule</span><b>${esc(s.schedule || "—")}</b>
      <span>Monthly fee</span><b>₹ ${esc(s.monthlyFee || 0)}</b>
    </div>

    <h3>Current tutor</h3>
    ${current ? card(current, null, true) + `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        <a class="btn btn-wa btn-sm" href="${esc(waLink(s.phone, parentMsgFor(s, current)))}" target="_blank" rel="noopener">${ICONS.wa}Send tutor details to parent</a>
      </div>` : `<div class="note warn">No tutor allocated yet. Pick one from the suggestions below.</div>`}

    <h3>Best-matched tutors <span class="sub" style="display:inline;font-weight:400">· subject${s.mode === "Online tuition" ? " + online" : " + area/city"} + class + experience</span></h3>
    ${!ready ? `<p class="sub">Loading tutors…</p>` : !ctx.tutors.length ? `<div class="note warn">No tutors yet. <a href="#/tutors">Import the tutor Excel</a> first.</div>` :
      matches.length ? matches.map((m) => card(m.t, m.hits, false)).join("") : `<div class="note">No tutor matches this subject. Search all tutors below.</div>`}

    <div class="fld" style="margin-top:10px"><label for="aTutorQ">Search all ${ready ? ctx.tutors.length : ""} tutors</label><input id="aTutorQ" placeholder="Name, mobile, subject or area" value="${esc(st.tutorQ)}"></div>
    <div id="aManual" style="margin-top:8px">${manual.map((t) => card(t, null, false)).join("")}</div>

    ${history.length ? `<h3>Allocation history</h3>
      <div class="table-wrap"><table class="t"><thead><tr><th>Tutor</th><th>From</th><th>By</th></tr></thead>
      <tbody>${history.map((h) => `<tr><td>${esc(h.tutorName || "Removed")}</td><td>${esc(fmtDate(h.on))}</td><td>${esc(String(h.by || "").split("@")[0])}</td></tr>`).join("")}</tbody></table></div>` : ""}`;

  const q = $("#aTutorQ", box);
  q.addEventListener("input", debounce(() => {
    st.tutorQ = q.value.trim();
    const list = st.tutorQ ? ctx.tutors.filter((t) => [t.name, t.phone, t.subjects, t.area, t.city].join(" ").toLowerCase().includes(st.tutorQ.toLowerCase())).slice(0, 8) : [];
    $("#aManual", box).innerHTML = list.length ? list.map((t) => card(t, null, false)).join("") : st.tutorQ ? `<p class="sub">No tutor found.</p>` : "";
  }, 200));
}

async function allocate(s, t) {
  const hist = (s.allocationHistory || []).concat([{ tutorId: t ? t.id : "", tutorName: t ? t.name : "", on: todayISO(), by: ctx.user.email }]).slice(-20);
  const patch = t
    ? { id: s.id, tutorId: t.id, tutorName: t.name, tutorPhone: normPhone(t.phone), allocatedOn: todayISO(), allocatedBy: ctx.user.email, allocationHistory: hist }
    : { id: s.id, tutorId: "", tutorName: "", tutorPhone: "", allocatedOn: "", allocationHistory: hist };
  await put("students", patch);
  if (s.bookingId) {
    put("bookings", { id: s.bookingId, tutorId: patch.tutorId, tutorName: patch.tutorName, tutorPhone: patch.tutorPhone }).catch(() => {});
  }
}

async function onDetailClick(e) {
  const s = ctx.students.find((x) => x.id === st.selected);
  if (!s) return;
  const a = e.target.closest("[data-assign]");
  if (a) {
    const t = (ctx.tutors || []).find((x) => x.id === a.dataset.assign);
    if (!t) return;
    a.disabled = true;
    try {
      await allocate(s, t);
      st.tutorQ = "";
      toast(`${t.name} allocated to ${s.name}. Send the details on WhatsApp.`, "ok");
    } catch (ex) { toast(ex.message, "bad"); a.disabled = false; }
  }
  if (e.target.closest("[data-unassign]")) {
    try { await allocate(s, null); toast("Tutor removed from " + s.name); } catch (ex) { toast(ex.message, "bad"); }
  }
}

// ── By tutor view ──
function renderByTutor() {
  const body = $("#aBody", root);
  const groups = new Map();
  active().filter((s) => s.tutorId).forEach((s) => {
    const g = groups.get(s.tutorId) || { name: s.tutorName, phone: s.tutorPhone, students: [] };
    g.students.push(s);
    groups.set(s.tutorId, g);
  });
  const q = st.tq.toLowerCase();
  const rows = [...groups.entries()]
    .filter(([, g]) => !q || [g.name, g.phone, ...g.students.map((s) => s.name)].join(" ").toLowerCase().includes(q))
    .sort((a, b) => b[1].students.length - a[1].students.length);
  body.innerHTML = `
    <div class="filters"><div class="fld grow"><label for="aTQ">Search tutor or student</label><input id="aTQ" value="${esc(st.tq)}" placeholder="Tutor name, mobile or student"></div></div>
    ${rows.length ? `<div class="table-wrap"><table class="t">
      <thead><tr><th>Tutor</th><th class="num">Students</th><th>Students allocated</th></tr></thead>
      <tbody>${rows.map(([id, g]) => `
        <tr>
          <td><span class="strong">${esc(g.name)}</span><span class="sub">${esc(fmtPhone(g.phone))}</span></td>
          <td class="num strong">${g.students.length}</td>
          <td>${g.students.map((s) => `<a href="#/allocation?student=${esc(s.id)}" style="display:inline-block;margin:0 10px 4px 0">${esc(s.name)} <span class="sub" style="display:inline">(${esc(s.studentClass || "")}, ${esc(s.subjects || "")})</span></a>`).join("")}</td>
        </tr>`).join("")}</tbody></table></div>` : `<div class="panel empty">No students are allocated to tutors yet.</div>`}`;
  const inp = $("#aTQ", body);
  inp.addEventListener("input", debounce(() => { st.tq = inp.value.trim(); renderByTutor(); const n = $("#aTQ", root); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
}

function exportAllocation() {
  exportXlsx({
    Allocation: active().map((s) => ({
      "Student": s.name, "Class": s.studentClass || "", "Board": s.board || "", "Subjects": s.subjects || "", "Tuition": s.mode || "",
      "Area": s.area || "", "City": s.city || "", "Parent": s.parentName || "", "Parent mobile": s.phone || "",
      "Tutor": s.tutorName || "NOT ALLOCATED", "Tutor mobile": s.tutorPhone || "", "Allocated on": s.allocatedOn || "", "Schedule": s.schedule || ""
    }))
  }, `CF-Academy-Allocation-${todayISO()}.xlsx`);
}

function refresh() {
  if (!root || !document.body.contains(root)) return;
  renderStats();
  if (st.view === "tutors") { if (!root.contains(document.activeElement) || document.activeElement.id !== "aTQ") renderByTutor(); return; }
  renderList();
  const box = $("#aDetail", root);
  const editing = box && box.contains(document.activeElement) && document.activeElement.matches("input, textarea, select");
  if (!editing) renderDetail();
}

export default { deps: ["students", "tutors"], render, refresh };
