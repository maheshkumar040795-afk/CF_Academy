// Tutors — 850+ faculty: search, add / edit / delete, Excel import & export
import { put, remove, bulkPut } from "../db.js";
import { SUBJECTS, EXAMS, CITIES } from "../site-config.js";
import { $, $$, esc, fmtPhone, normPhone, toast, modal, confirmBox, readFields, options, exportXlsx, debounce, todayISO, ICONS } from "./ui.js";
import { canonSubjects } from "./common.js";
import { openTutorFinance, openSalarySheet, payoutFor, currentPeriod } from "./tutorpay.js";

const PAGE = 50;
const st = { q: "", subject: "", city: "", mode: "", status: "", page: 0 };
let root, ctx;

// Columns of the Excel template (also the export format)
export const TUTOR_COLUMNS = [
  ["name", "Name"], ["phone", "Mobile"], ["gender", "Gender"], ["qualification", "Qualification"],
  ["experience", "Experience (years)"], ["subjects", "Subjects"], ["classes", "Classes"], ["board", "Board"],
  ["mode", "Mode (Home/Online/Both)"], ["area", "Areas"], ["city", "City"], ["fee", "Fee per hour"],
  ["status", "Status (Active/Inactive)"], ["notes", "Notes"]
];

// Header aliases so the client's own Excel works without renaming columns
const HEADER_ALIASES = {
  name: ["name", "tutorname", "fullname", "facultyname", "teachername", "tutor", "faculty"],
  phone: ["mobile", "phone", "mobileno", "mobilenumber", "phoneno", "phonenumber", "contact", "contactno", "contactnumber", "whatsapp", "cell"],
  gender: ["gender", "sex", "mf"],
  qualification: ["qualification", "qual", "education", "degree", "qualifications"],
  experience: ["experience", "exp", "experienceyears", "yearsofexperience", "experienceinyears", "expyears", "years"],
  subjects: ["subjects", "subject", "subjectstaught", "specialization", "specialisation"],
  classes: ["classes", "class", "grades", "grade", "standard", "standards", "level"],
  board: ["board", "boards", "syllabus", "curriculum"],
  mode: ["mode", "modehomeonlineboth", "tuitionmode", "tuitiontype", "type", "teachingmode"],
  area: ["areas", "area", "location", "locality", "locations", "preferredarea", "preferredareas", "place"],
  city: ["city", "district", "town"],
  fee: ["feeperhour", "fee", "fees", "rate", "hourlyrate", "charges", "feehr"],
  status: ["statusactiveinactive", "status", "active"],
  notes: ["notes", "remarks", "comment", "comments"]
};
const normHeader = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function filtered() {
  const q = st.q.toLowerCase();
  const subjCanon = st.subject ? [...canonSubjects(st.subject)][0] : "";
  return (ctx.tutors || []).filter((t) => {
    if (st.status && (t.status || "Active") !== st.status) return false;
    if (st.city && !String(t.city || "").toLowerCase().includes(st.city.toLowerCase().replace(/\s*\(.*\)/, ""))) return false;
    if (st.mode && !String(t.mode || "").toLowerCase().includes(st.mode.toLowerCase()) && !/both/i.test(t.mode || "")) return false;
    if (subjCanon && !canonSubjects(t.subjects).has(subjCanon)) return false;
    if (q && ![t.name, t.phone, t.subjects, t.area, t.city, t.qualification].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
}

function render(view, c) {
  root = view; ctx = c;
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Tutors</h1><p id="tCount">Loading tutors…</p></div>
      <div class="actions">
        <button class="btn btn-ghost" id="tSalary">${ICONS.fees}Salary sheet</button>
        <button class="btn btn-ghost" id="tTemplate">${ICONS.download}Excel template</button>
        <button class="btn btn-ghost" id="tExport">${ICONS.download}Export all</button>
        <button class="btn btn-accent" id="tImport">${ICONS.upload}Import Excel</button>
        <button class="btn btn-navy" id="tAdd">${ICONS.plus}Add tutor</button>
      </div>
    </div>
    <div class="filters">
      <div class="fld grow"><label for="tQ">Search</label><input id="tQ" placeholder="Name, mobile, subject, area" value="${esc(st.q)}"></div>
      <div class="fld"><label for="tSubj">Subject</label><select id="tSubj">${options([...SUBJECTS.filter((s) => s !== "All Subjects"), ...EXAMS], st.subject, "All subjects / exams")}</select></div>
      <div class="fld"><label for="tCity">City</label><select id="tCity">${options(CITIES, st.city, "All cities")}</select></div>
      <div class="fld"><label for="tMode">Mode</label><select id="tMode">${options(["Home", "Online"], st.mode, "Any")}</select></div>
      <div class="fld"><label for="tStatus">Status</label><select id="tStatus">${options(["Active", "Inactive"], st.status, "All")}</select></div>
    </div>
    <div id="tList"></div>
    <div class="pager" id="tPager"></div>
    <input type="file" id="tFile" accept=".xlsx,.xls,.csv" hidden>`;

  $("#tQ", view).addEventListener("input", debounce((e) => { st.q = e.target.value.trim(); st.page = 0; renderList(); }, 200));
  [["#tSubj", "subject"], ["#tCity", "city"], ["#tMode", "mode"], ["#tStatus", "status"]].forEach(([sel, key]) =>
    $(sel, view).addEventListener("change", (e) => { st[key] = e.target.value; st.page = 0; renderList(); }));
  $("#tAdd", view).addEventListener("click", () => editTutor(null));
  $("#tTemplate", view).addEventListener("click", downloadTemplate);
  $("#tSalary", view).addEventListener("click", () => openSalarySheet(ctx));
  $("#tExport", view).addEventListener("click", exportAll);
  $("#tImport", view).addEventListener("click", () => {
    if (!window.XLSX) { toast("Excel library is still loading — try again in a moment.", "bad"); return; }
    $("#tFile", view).value = ""; $("#tFile", view).click();
  });
  $("#tFile", view).addEventListener("change", (e) => e.target.files[0] && importFile(e.target.files[0]));
  $("#tList", view).addEventListener("click", onListClick);

  renderList();
  ctx.ensureTutors().catch((e) => { toast("Could not load tutors: " + e.message, "bad"); });
}

function activeStudentsOf(tid) {
  return ctx.students.filter((s) => s.tutorId === tid && (s.status || "Active") === "Active").length;
}

function renderList() {
  if (!root) return;
  if (!Array.isArray(ctx.tutors)) { $("#tList", root).innerHTML = `<div class="panel empty">Loading tutors…</div>`; return; }
  const all = ctx.tutors;
  const active = all.filter((t) => (t.status || "Active") === "Active").length;
  $("#tCount", root).textContent = `${all.length} tutors · ${active} active. Only admins see this list — use it to allocate tutors to bookings.`;
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  if (st.page >= pages) st.page = pages - 1;
  const slice = rows.slice(st.page * PAGE, st.page * PAGE + PAGE);
  const counts = {};
  ctx.students.forEach((s) => { if (s.tutorId && (s.status || "Active") === "Active") counts[s.tutorId] = (counts[s.tutorId] || 0) + 1; });
  $("#tList", root).innerHTML = !all.length ? `
    <div class="panel empty">
      <p style="margin:0 0 12px"><b>No tutors yet.</b> Import your Excel sheet of 850 tutors, or add them one by one.</p>
      <button class="btn btn-ghost" data-act="template">${ICONS.download}Download Excel template</button>
    </div>` : rows.length ? `
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Tutor</th><th>Subjects · classes</th><th>Areas · city</th><th>Mode</th><th class="num">Exp</th><th class="num">Salary/hr</th><th class="num">Students</th><th>Status</th><th></th></tr></thead>
      <tbody>${slice.map((t) => `
        <tr>
          <td><span class="strong">${esc(t.name)}</span><span class="sub">${esc(fmtPhone(t.phone))}${t.gender ? " · " + esc(t.gender) : ""}${t.qualification ? " · " + esc(t.qualification) : ""}</span></td>
          <td>${esc(t.subjects)}<span class="sub">${esc(t.classes || "")}${t.board ? " · " + esc(t.board) : ""}</span></td>
          <td>${esc(t.area || "—")}<span class="sub">${esc(t.city || "")}</span></td>
          <td>${esc(t.mode || "—")}</td>
          <td class="num">${t.experience ? esc(t.experience) + " y" : "—"}</td>
          <td class="num">${t.fee ? "₹" + esc(t.fee) : "—"}</td>
          <td class="num">${counts[t.id] || 0}</td>
          <td><span class="pill ${(t.status || "Active") === "Active" ? "p-paid" : "p-lost"}">${esc(t.status || "Active")}</span></td>
          <td style="white-space:nowrap">
            ${finBtn(t, counts[t.id] || 0)}
            <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${esc(t.id)}">Edit</button>
            ${ctx.isAdmin ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${esc(t.id)}">Delete</button>` : ""}
          </td>
        </tr>`).join("")}
      </tbody></table></div>` : `<div class="panel empty">No tutors match these filters.</div>`;
  $("#tPager", root).innerHTML = rows.length > PAGE ? `
    <span>Showing ${st.page * PAGE + 1}–${Math.min(rows.length, (st.page + 1) * PAGE)} of ${rows.length}</span>
    <span class="btns"><button class="btn btn-ghost btn-sm" data-p="-1" ${st.page === 0 ? "disabled" : ""}>Previous</button><button class="btn btn-ghost btn-sm" data-p="1" ${st.page >= pages - 1 ? "disabled" : ""}>Next</button></span>` : rows.length ? `<span>${rows.length} tutor${rows.length === 1 ? "" : "s"}</span>` : "";
  $$("[data-p]", $("#tPager", root)).forEach((b) => b.addEventListener("click", () => { st.page += Number(b.dataset.p); renderList(); window.scrollTo({ top: 0, behavior: "smooth" }); }));
}

// ₹ Finance button: green when this month's salary is paid, amber when pending
function finBtn(t, n) {
  const p = payoutFor(ctx, t.id, "month", currentPeriod("month"));
  const cls = p ? (p.status === "Paid" ? "fin-paid" : "fin-pending") : n ? "fin-due" : "";
  const tip = p ? `${p.status === "Paid" ? "Salary paid" : "Salary pending"} for this month` : n ? "Salary for this month not paid yet" : "Salary / finance";
  return `<button class="icon-btn ${cls}" data-act="fin" data-id="${esc(t.id)}" title="${esc(tip)}" aria-label="Salary for ${esc(t.name)}: ${esc(tip)}">${ICONS.fees}</button>`;
}

async function onListClick(e) {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  if (b.dataset.act === "template") return downloadTemplate();
  const t = ctx.tutors.find((x) => x.id === b.dataset.id);
  if (!t) return;
  if (b.dataset.act === "edit") editTutor(t);
  if (b.dataset.act === "fin") openTutorFinance(ctx, t);
  if (b.dataset.act === "del") {
    const n = activeStudentsOf(t.id);
    const msg = n
      ? `<b>${esc(t.name)}</b> is teaching <b>${n} active student${n > 1 ? "s" : ""}</b>. Reassign them first from Students, or mark the tutor Inactive instead.<br><br>Delete anyway?`
      : `Delete <b>${esc(t.name)}</b> (${esc(fmtPhone(t.phone))})? This cannot be undone.`;
    if (!(await confirmBox("Delete tutor?", msg, "Delete tutor"))) return;
    await remove("tutors", t.id);
    ctx.setTutors(ctx.tutors.filter((x) => x.id !== t.id));
    toast("Tutor deleted");
  }
}

function editTutor(t) {
  const v = t || { status: "Active", city: "Chennai", mode: "Home" };
  modal({
    title: t ? "Edit tutor" : "Add tutor",
    body: `
      <div class="form-grid" id="tuForm">
        <div class="fld"><label>Full name *</label><input name="name" value="${esc(v.name)}"></div>
        <div class="fld"><label>Mobile *</label><input name="phone" inputmode="numeric" value="${esc(v.phone)}"></div>
        <div class="fld"><label>Gender</label><select name="gender">${options(["Female", "Male"], v.gender, "—")}</select></div>
        <div class="fld"><label>Qualification</label><input name="qualification" value="${esc(v.qualification)}" placeholder="M.Sc., B.Ed."></div>
        <div class="fld full"><label>Subjects *</label><input name="subjects" value="${esc(v.subjects)}" placeholder="Mathematics, Physics"></div>
        <div class="fld"><label>Classes</label><input name="classes" value="${esc(v.classes)}" placeholder="6 - 12"></div>
        <div class="fld"><label>Board</label><input name="board" value="${esc(v.board)}" placeholder="CBSE, State Board"></div>
        <div class="fld"><label>Mode</label><select name="mode">${options(["Home", "Online", "Both"], v.mode)}</select></div>
        <div class="fld"><label>Experience (years)</label><input name="experience" type="number" min="0" value="${esc(v.experience)}"></div>
        <div class="fld full"><label>Areas served</label><input name="area" value="${esc(v.area)}" placeholder="Velachery, Adyar, Guindy"></div>
        <div class="fld"><label>City</label><input name="city" list="cityList" value="${esc(v.city)}"><datalist id="cityList">${CITIES.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
        <div class="fld"><label>Salary per hour (₹)</label><input name="fee" type="number" min="0" value="${esc(v.fee)}"></div>
        <div class="fld"><label>UPI ID (for salary)</label><input name="upi" value="${esc(v.upi || "")}" placeholder="name@okaxis"></div>
        <div class="fld"><label>Status</label><select name="status">${options(["Active", "Inactive"], v.status || "Active")}</select></div>
        <div class="fld full"><label>Notes</label><textarea name="notes">${esc(v.notes)}</textarea></div>
      </div>`,
    actions: [
      { label: "Cancel" },
      {
        label: t ? "Save changes" : "Add tutor", kind: "btn-navy", onClick: async (close, m) => {
          const f = readFields($("#tuForm", m));
          f.phone = normPhone(f.phone);
          if (!f.name || f.phone.length !== 10 || !f.subjects) { toast("Name, 10-digit mobile and subjects are required", "bad"); return false; }
          const dup = ctx.tutors.find((x) => normPhone(x.phone) === f.phone && (!t || x.id !== t.id));
          if (dup) { toast(`This mobile already belongs to ${dup.name}`, "bad"); return false; }
          f.experience = f.experience === "" ? "" : Number(f.experience);
          f.fee = f.fee === "" ? "" : Number(f.fee);
          const id = await put("tutors", t ? { ...f, id: t.id } : f);
          const now = Date.now();
          const saved = { ...(t || { createdAt: now }), ...f, id, updatedAt: now };
          ctx.setTutors(t ? ctx.tutors.map((x) => (x.id === id ? saved : x)) : [saved, ...ctx.tutors]);
          toast(t ? "Tutor updated" : "Tutor added", "ok");
        }
      }
    ]
  });
}

function downloadTemplate() {
  const sample = [
    { name: "Priya R", phone: "9876543210", gender: "Female", qualification: "M.Sc., B.Ed.", experience: 8, subjects: "Mathematics, Physics", classes: "6 - 12", board: "CBSE, State Board", mode: "Both", area: "Velachery, Adyar, Guindy", city: "Chennai", fee: 400, status: "Active", notes: "" },
    { name: "Karthik S", phone: "9123456780", gender: "Male", qualification: "B.E.", experience: 5, subjects: "Chemistry", classes: "11 - 12", board: "CBSE", mode: "Online", area: "", city: "Coimbatore", fee: 500, status: "Active", notes: "" }
  ];
  const rows = sample.map((r) => Object.fromEntries(TUTOR_COLUMNS.map(([k, label]) => [label, r[k]])));
  exportXlsx({ Tutors: rows }, "CF-Academy-Tutor-Template.xlsx");
}

function exportAll() {
  const rows = (ctx.tutors || []).map((t) => Object.fromEntries(TUTOR_COLUMNS.map(([k, label]) => [label, t[k] == null ? "" : t[k]])));
  exportXlsx({ Tutors: rows }, `CF-Academy-Tutors-${todayISO()}.xlsx`);
}

// ── Excel import ──
function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const n = normHeader(h);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[key] == null && aliases.includes(n)) { map[key] = i; break; }
    }
  });
  // looser second pass: header contains an alias (e.g. "Tutor Mobile No.")
  headers.forEach((h, i) => {
    const n = normHeader(h);
    if (Object.values(map).includes(i)) return;
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[key] == null && aliases.some((a) => a.length >= 4 && n.includes(a))) { map[key] = i; break; }
    }
  });
  return map;
}

function parseRows(aoa) {
  // find header row: first row within the top 10 that maps name + phone
  let hi = 0, map = null;
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const m = mapHeaders(aoa[i] || []);
    if (m.name != null && m.phone != null) { hi = i; map = m; break; }
  }
  if (!map) return { error: "Could not find the Name and Mobile columns. Use the Excel template headings." };

  const existing = new Map((ctx.tutors || []).map((t) => [normPhone(t.phone), t]));
  const seen = new Map();
  const errors = [];
  let blank = 0;
  for (let r = hi + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const get = (k) => (map[k] == null ? "" : String(row[map[k]] == null ? "" : row[map[k]]).trim());
    if (!row.some((c) => String(c == null ? "" : c).trim())) { blank++; continue; }
    const t = {};
    Object.keys(HEADER_ALIASES).forEach((k) => { t[k] = get(k); });
    t.phone = normPhone(t.phone);
    const line = r + 1;
    if (!t.name) { errors.push(`Row ${line}: name is empty`); continue; }
    if (t.phone.length !== 10) { errors.push(`Row ${line} (${t.name}): mobile "${get("phone")}" is not 10 digits`); continue; }
    if (!t.subjects) { errors.push(`Row ${line} (${t.name}): subjects are empty`); continue; }
    t.experience = t.experience ? Number(String(t.experience).replace(/[^\d.]/g, "")) || t.experience : "";
    t.fee = t.fee ? Number(String(t.fee).replace(/[^\d.]/g, "")) || t.fee : "";
    t.status = /^\s*(inactive|no|n|0|false|left)\s*$/i.test(t.status) ? "Inactive" : "Active";
    if (t.mode) t.mode = /both|all/i.test(t.mode) || (/home|offline/i.test(t.mode) && /online/i.test(t.mode)) ? "Both" : /online/i.test(t.mode) ? "Online" : "Home";
    if (t.gender) t.gender = /^f/i.test(t.gender) ? "Female" : /^m/i.test(t.gender) ? "Male" : t.gender;
    if (seen.has(t.phone)) errors.push(`Row ${line} (${t.name}): same mobile as row ${seen.get(t.phone).line} — the later row is used`);
    seen.set(t.phone, { ...t, line });
  }
  const rows = [...seen.values()].map(({ line, ...t }) => {
    const ex = existing.get(t.phone);
    return ex ? { ...t, id: ex.id } : t;
  });
  const updates = rows.filter((r) => r.id).length;
  const mapped = Object.keys(map);
  return { rows, errors, updates, adds: rows.length - updates, blank, mapped, headerRow: hi + 1 };
}

async function importFile(file) {
  let res;
  try {
    await ctx.ensureTutors(); // needed to detect existing tutors (update instead of duplicate)
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    res = parseRows(aoa);
  } catch (e) {
    toast("Could not read this file: " + e.message, "bad");
    return;
  }
  if (res.error) { modal({ title: "Import tutors", body: `<div class="note bad">${esc(res.error)}</div>`, actions: [{ label: "OK" }] }); return; }
  const missing = TUTOR_COLUMNS.map(([k]) => k).filter((k) => !res.mapped.includes(k));
  modal({
    title: `Import tutors from ${file.name}`,
    wide: true,
    body: `
      <div class="stats" style="margin-bottom:14px">
        <div class="stat good"><span>Ready to import</span><b>${res.rows.length}</b></div>
        <div class="stat"><span>New tutors</span><b>${res.adds}</b></div>
        <div class="stat"><span>Updates (same mobile)</span><b>${res.updates}</b></div>
        <div class="stat ${res.errors.length ? "bad" : ""}"><span>Rows with problems</span><b>${res.errors.length}</b></div>
      </div>
      ${missing.length ? `<div class="note warn" style="margin-bottom:10px">Columns not found (will be left empty): ${missing.map(esc).join(", ")}</div>` : ""}
      ${res.errors.length ? `<div class="note bad">These rows will be skipped or merged:<ul class="err-list">${res.errors.slice(0, 200).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>${res.errors.length > 200 ? `<p style="margin:6px 0 0">…and ${res.errors.length - 200} more</p>` : ""}</div>` : `<div class="note ok">All rows look good.</div>`}
      <h3 style="font-size:14px;color:var(--navy);margin:16px 0 8px">Preview (first 5)</h3>
      <div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Mobile</th><th>Subjects</th><th>Areas</th><th>City</th><th>Mode</th></tr></thead>
      <tbody>${res.rows.slice(0, 5).map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.phone)}</td><td>${esc(t.subjects)}</td><td>${esc(t.area)}</td><td>${esc(t.city)}</td><td>${esc(t.mode)}</td></tr>`).join("")}</tbody></table></div>
      <div id="impProg" hidden style="margin-top:16px"><div class="progress"><div></div></div><p class="sub" id="impTxt" style="margin-top:6px"></p></div>`,
    actions: [
      { label: "Cancel" },
      {
        label: `Import ${res.rows.length} tutors`, kind: "btn-navy", onClick: async (close, m) => {
          if (!res.rows.length) return;
          $("#impProg", m).hidden = false;
          $$(".modal-f .btn", m).forEach((b) => (b.disabled = true));
          try {
            await bulkPut("tutors", res.rows, (done, total) => {
              $("#impProg .progress div", m).style.width = Math.round((done / total) * 100) + "%";
              $("#impTxt", m).textContent = `Saved ${done} of ${total}…`;
            });
            await ctx.ensureTutors(true);
            toast(`Imported ${res.rows.length} tutors (${res.adds} new, ${res.updates} updated)`, "ok");
          } catch (e) {
            toast("Import stopped: " + e.message, "bad");
            $$(".modal-f .btn", m).forEach((b) => (b.disabled = false));
            return false;
          }
        }
      }
    ]
  });
}

function refresh() { renderList(); }

export default { deps: ["tutors", "students", "tutorPayouts"], render, refresh };
