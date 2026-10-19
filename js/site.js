// CF Academy — home page: booking form, programmes, courses table, tutors, banners
import { SITE, SUBJECTS, EXAMS, CLASSES, BOARDS, TIME_SLOTS, DAYS, PROGRAMS, CATEGORIES } from "./site-config.js?v=202610192000";
import { createBooking, sendToSheet, makeBookingNo, isDemo, listBanners, listFeaturedTutors } from "./db.js?v=202610192000";
import { $, $$, escAttr, toast, reveal, idle, reduceMotion } from "./common.js?v=202610192000";
import { cld } from "./cloudinary.js?v=202610192000";

function fillSelect(sel, items, placeholder) {
  sel.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : "") +
    items.map((v) => `<option>${v}</option>`).join("");
}

function makeChips(box, items) {
  box.innerHTML = items.map((v) => `<button type="button" class="chip" aria-pressed="false" data-v="${v}">${v}</button>`).join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
    const f = box.closest(".f");
    if (f) f.classList.remove("invalid");
  });
}
const chipValues = (box) => $$('.chip[aria-pressed="true"]', box).map((b) => b.dataset.v);
function setChips(box, values) {
  $$(".chip", box).forEach((b) => b.setAttribute("aria-pressed", values.includes(b.dataset.v) ? "true" : "false"));
}

// ── Booking form ──
const form = () => $("#bookForm");
function currentMode() { return $('input[name="mode"]:checked').value; }

function syncMode() {
  const home = currentMode() === "Home tuition";
  $("#areaReq").style.display = home ? "" : "none";
}
// Class is optional when only a competitive exam is chosen
function syncClassReq() {
  const examOnly = chipValues($("#examChips")).length > 0 && chipValues($("#subjectChips")).length === 0;
  $("#classReq").style.display = examOnly ? "none" : "";
  return !examOnly;
}
const pickedSubjects = () => [...chipValues($("#subjectChips")), ...chipValues($("#examChips"))];

function normPhone(p) {
  let d = String(p == null ? "" : p).replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

function validate() {
  let ok = true;
  const mark = (key, bad) => {
    const f = $(`.f[data-f="${key}"]`);
    if (f) f.classList.toggle("invalid", bad);
    if (bad) ok = false;
  };
  mark("studentName", !$("#studentName").value.trim());
  mark("studentClass", syncClassReq() && !$("#studentClass").value);
  mark("subjects", pickedSubjects().length === 0);
  mark("area", currentMode() === "Home tuition" && !$("#area").value.trim());
  mark("parentName", !$("#parentName").value.trim());
  mark("phone", !/^[6-9]\d{9}$/.test(normPhone($("#phone").value)));
  if (!ok) {
    const first = $(".f.invalid");
    first && first.scrollIntoView({ behavior: "smooth", block: "center" });
    const inp = first && first.querySelector("input, select, button");
    inp && setTimeout(() => inp.focus({ preventScroll: true }), 300);
  }
  return ok;
}

function readForm() {
  const v = (id) => $("#" + id).value.trim();
  return {
    bookingNo: makeBookingNo(),
    mode: currentMode(),
    studentName: v("studentName"),
    studentClass: v("studentClass"),
    board: v("board"),
    subjects: pickedSubjects().join(", "),
    area: v("area"),
    days: chipValues($("#dayChips")).join(", "),
    time: v("time"),
    startDate: v("startDate"),
    parentName: v("parentName"),
    phone: normPhone(v("phone")),
    notes: v("notes")
  };
}

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function whatsappText(b) {
  const lines = [
    "Hello CF Academy, I would like to book a tutor.",
    "",
    `*Booking ID:* ${b.bookingNo}`,
    `*Tuition type:* ${b.mode}`,
    `*Student:* ${b.studentName}${b.studentClass || b.board ? ` (${[b.studentClass, b.board].filter(Boolean).join(", ")})` : ""}`,
    `*Subjects / exam:* ${b.subjects}`
  ];
  if (b.area) lines.push(`*Location:* ${b.area}`);
  if (b.days) lines.push(`*Preferred days:* ${b.days}`);
  if (b.time) lines.push(`*Preferred time:* ${b.time}`);
  if (b.startDate) lines.push(`*Start from:* ${fmtDate(b.startDate)}`);
  lines.push(`*Parent:* ${b.parentName}`, `*Mobile:* ${b.phone}`);
  if (b.notes) lines.push(`*Notes:* ${b.notes}`);
  return lines.join("\n");
}

async function onSubmit(e) {
  e.preventDefault();
  if (!validate()) { toast("Please fill the highlighted fields."); return; }
  const btn = $("#submitBtn");
  const b = readForm();
  const waUrl = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(whatsappText(b))}`;

  // Open WhatsApp straight away (inside the click, so browsers allow it).
  const win = window.open(waUrl, "_blank");
  try { if (win) win.opener = null; } catch (err) { /* ignore */ }

  btn.disabled = true;
  btn.style.opacity = ".7";
  try {
    await Promise.all([createBooking(b), sendToSheet(b)]);
  } catch (err) {
    console.error("Booking save failed", err);
    toast("Saved on WhatsApp. If it did not send, please call us.");
  }
  btn.disabled = false;
  btn.style.opacity = "";

  $("#doneId").textContent = "Booking ID: " + b.bookingNo;
  $("#doneWa").href = waUrl;
  form().style.display = "none";
  $("#bookDone").classList.add("show");
  $("#book").scrollIntoView({ behavior: "smooth", block: "start" });
  if (!win) toast("Tap “Open WhatsApp again” to send your booking.");
  if (isDemo) console.info("Demo mode: booking saved in this browser only.", b);
}

function resetForm() {
  form().reset();
  setChips($("#subjectChips"), []);
  setChips($("#examChips"), []);
  syncClassReq();
  setChips($("#dayChips"), []);
  $$(".f.invalid").forEach((f) => f.classList.remove("invalid"));
  syncMode();
  $("#bookDone").classList.remove("show");
  form().style.display = "";
  $("#studentName").focus();
}

// ── Quick search card in hero → prefill booking form ──
function initQuick() {
  let qmode = "Home tuition";
  $$("[data-qmode]").forEach((b) => b.addEventListener("click", () => {
    qmode = b.dataset.qmode;
    $$("[data-qmode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#qArea").placeholder = qmode === "Home tuition" ? "e.g. Velachery, Anna Nagar, Tambaram" : "Your city (e.g. Madurai)";
  }));
  $("#quickForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = $(`input[name="mode"][value="${qmode}"]`);
    if (r) r.checked = true;
    syncMode();
    const subj = $("#qSubject").value;
    if (SUBJECTS.includes(subj)) setChips($("#subjectChips"), [subj]);
    else if (EXAMS.includes(subj)) setChips($("#examChips"), [subj]);
    syncClassReq();
    if ($("#qClass").value) $("#studentClass").value = $("#qClass").value;
    const area = $("#qArea").value.trim();
    if (area) $("#area").value = area;
    $("#book").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => $("#studentName").focus({ preventScroll: true }), 600);
  });
}

// ── Programme cards ──
const PROG_ICONS = {
  blocks: '<path d="M4 14h7v7H4zM13 14h7v7h-7zM8.5 4h7v7h-7z"/>',
  pencil: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  code: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M13.5 5l-3 14"/>'
};
function renderPrograms() {
  const box = $("#programs");
  if (!box) return;
  box.innerHTML = PROGRAMS.map((p, i) => `
    <article class="prog reveal">
      <div class="prog-media${p.image ? " has-img" : ""}">
        ${p.image
          ? `<img class="bg" src="${escAttr(cld(p.image, 48, "e_blur:300"))}" alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="this.remove()"><img class="fg" src="${escAttr(cld(p.image, 420))}" srcset="${escAttr(cld(p.image, 420))} 420w, ${escAttr(cld(p.image, 800))} 800w" sizes="(max-width: 640px) 92vw, (max-width: 960px) 46vw, 380px" alt="${escAttr(p.title)}" loading="lazy" decoding="async" onerror="this.parentNode.classList.remove('has-img');this.parentNode.querySelectorAll('img').forEach(function(i){i.remove()})">`
          : ""}
        <div class="ph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${PROG_ICONS[p.icon] || PROG_ICONS.book}</svg></div>
      </div>
      <div class="prog-body">
        <span class="prog-tag">${escAttr(p.tag)}</span>
        <h4>${escAttr(p.title)}</h4>
        <p>${escAttr(p.text)}</p>
        <button type="button" class="prog-cta" data-prog="${i}">Book now <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
      </div>
    </article>`).join("");
  box.setAttribute("data-stagger", "");
  reveal($$(".reveal", box));
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-prog]");
    if (!b) return;
    const p = PROGRAMS[Number(b.dataset.prog)];
    if (p.cls) $("#studentClass").value = p.cls;
    if (p.subject) setChips($("#subjectChips"), [p.subject]);
    if (p.note && !$("#notes").value) $("#notes").value = p.note;
    $$(".f.invalid").forEach((f) => f.classList.remove("invalid"));
    if (p.exam) { $("#examLbl").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    $("#book").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => $("#studentName").focus({ preventScroll: true }), 600);
  });
}

// ── Find a tutor for anything (tabs) ──
function prefillBooking(it, mode) {
  if (mode) { const r = $(`input[name="mode"][value="${mode}"]`); if (r) { r.checked = true; syncMode(); } }
  if (it.cls) $("#studentClass").value = it.cls;
  if (it.board) $("#board").value = it.board;
  if (it.subject && SUBJECTS.includes(it.subject)) setChips($("#subjectChips"), [it.subject]);
  if (it.exam && EXAMS.includes(it.exam)) { setChips($("#examChips"), [it.exam]); syncClassReq(); }
  const note = it.note || (!it.cls && !it.subject && !it.board && !it.exam ? it.label : "");
  if (!note && !it.subject) $("#notes").value = $("#notes").value.replace(/^Interested in: .*$/, "");
  if (note) $("#notes").value = "Interested in: " + note;
  $$(".f.invalid").forEach((f) => f.classList.remove("invalid"));
  $("#book").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => $("#studentName").focus({ preventScroll: true }), 600);
}
function initExplore() {
  const tabs = $("#exTabs"), panel = $("#exPanel");
  if (!tabs) return;
  let cur = 0;
  tabs.innerHTML = CATEGORIES.map((c, i) => `<button type="button" class="ex-tab" role="tab" id="ext${i}" aria-controls="exPanel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${escAttr(c.tab)}</button>`).join("");
  const show = (i) => {
    cur = i;
    const cat = CATEGORIES[i];
    $$(".ex-tab", tabs).forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    panel.setAttribute("aria-labelledby", "ext" + i);
    const weights = cat.groups.map((g) => (g.cols === 2 ? "1.6fr" : "1fr")).join(" ");
    panel.style.gridTemplateColumns = weights;
    panel.innerHTML = cat.groups.map((g, gi) => `
      <div class="ex-group">
        <h3>${escAttr(g.title)}</h3>
        <ul class="ex-list ${g.cols === 2 ? "c2" : ""}" ${g.cols === 2 ? `style="grid-template-rows:repeat(${Math.ceil(g.items.length / 2)},auto);grid-auto-flow:column"` : ""}>${g.items.map((it, ii) => `<li><button type="button" data-g="${gi}" data-i="${ii}">${escAttr(it.label)}${it.badge ? `<sup class="ex-new">${escAttr(it.badge)}</sup>` : ""}</button></li>`).join("")}</ul>
      </div>`).join("");
  };
  tabs.addEventListener("click", (e) => { const t = e.target.closest(".ex-tab"); if (t) show([...tabs.children].indexOf(t)); });
  tabs.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = (cur + (e.key === "ArrowRight" ? 1 : -1) + CATEGORIES.length) % CATEGORIES.length;
    show(n); tabs.children[n].focus();
  });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-g]"); if (!b) return;
    const cat = CATEGORIES[cur];
    const it = cat.groups[Number(b.dataset.g)].items[Number(b.dataset.i)];
    prefillBooking(it, it.mode || cat.mode);
  });
  show(0);
  // "See all exams / courses" buttons on the service cards open the matching tab
  // "Book home / online tuition" on the service cards pick the tuition type
  $$("[data-mode-book]").forEach((b) => b.addEventListener("click", () => {
    const r = $(`input[name="mode"][value="${b.dataset.modeBook}"]`);
    if (r) { r.checked = true; syncMode(); }
    $("#book").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => $("#studentName").focus({ preventScroll: true }), 600);
  }));
  $$("[data-explore]").forEach((b) => b.addEventListener("click", () => {
    const i = CATEGORIES.findIndex((c) => c.tab === b.dataset.explore);
    if (i >= 0) show(i);
    $("#explore").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

// ── Meet our tutors (cards managed in Admin → Website Tutors) ──
const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
function renderTutors(list) {
  const sec = $("#tutors"), box = $("#tutorList");
  if (!sec || !box) return;
  if (!list.length) { sec.hidden = true; return; }
  const card = (t, hidden) => `
    <article class="tutor"${hidden ? ' aria-hidden="true"' : ""}>
      <div class="t-ph">${t.photo
        ? `<img src="${escAttr(cld(t.photo, 200))}" alt="${escAttr(t.name)}" width="96" height="96" loading="lazy" decoding="async">`
        : `<span class="t-in" aria-hidden="true">${escAttr(initials(t.name))}</span>`}</div>
      <b>${escAttr(t.name)}</b>
      ${t.experience ? `<span class="t-exp">${escAttr(/exp/i.test(t.experience) ? t.experience : t.experience + " experience")}</span>` : ""}
      ${t.subject ? `<span class="t-sub">${escAttr(t.subject)}</span>` : ""}
    </article>`;
  // Train: one set is repeated until it is wider than a big screen, then doubled so the
  // loop (translateX -50% → 0, i.e. left to right) is seamless. Pauses on hover / touch.
  const reps = Math.max(1, Math.ceil(2000 / (list.length * 240)));
  const set = Array.from({ length: reps }, (_, r) => list.map((t) => card(t, r > 0)).join("")).join("");
  const copy = Array.from({ length: reps }, () => list.map((t) => card(t, true)).join("")).join("");
  box.innerHTML = `<div class="t-track" style="--dur:${Math.max(20, list.length * reps * 4)}s">${set}${copy}</div>`;
  box.classList.add("train");
  box.removeAttribute("data-stagger");
  sec.hidden = false;
  reveal($$(".reveal", sec));
}
async function initTutors() {
  try { renderTutors(await listFeaturedTutors(renderTutors)); } catch (e) { console.warn("Tutors not loaded", e); }
}

// ── Ad banner slider (slides managed in Admin → Website Banners) ──
let bannersStarted = false;
async function initBanners() {
  let list = [];
  try { list = await listBanners((fresh) => { if (!bannersStarted && fresh.length) buildBanners(fresh); }); } catch (e) { console.warn("Banners not loaded", e); return; }
  if (list.length) buildBanners(list);
}
function buildBanners(list) {
  bannersStarted = true;
  if (!list.length) return;
  const section = $("#banners");
  const slider = $("#slider");
  const track = $("#slides");
  const dots = $("#slDots");
  track.innerHTML = list.map((b, i) => {
    const safeLink = b.link === "#book" || /^https?:\/\//i.test(b.link || "") ? b.link : "";
    const ext = /^https?:/i.test(safeLink);
    const set = /res\.cloudinary\.com/.test(b.image) ? ` srcset="${escAttr(cld(b.image, 880))} 880w, ${escAttr(cld(b.image, 1400))} 1400w, ${escAttr(cld(b.image, 1756))} 1756w, ${escAttr(cld(b.image, 2083))} 2083w" sizes="(max-width: 1240px) 100vw, 1160px"` : "";
    const img = `<img src="${escAttr(cld(b.image, 2083))}"${set} alt="${escAttr(b.title)}" width="${Number(b.width) || 1756}" height="${Number(b.height) || 450}" ${i ? 'loading="lazy"' : ""} decoding="async" draggable="false">`;
    return `<div class="slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${list.length}">${safeLink ? `<a href="${escAttr(safeLink)}" ${ext ? 'target="_blank" rel="noopener"' : ""}>${img}</a>` : img}</div>`;
  }).join("");
  // Each slide is shown at its own uploaded shape (no white borders, no cropping):
  // the banner box takes the shape of the slide that is showing.
  const ratios = list.map((b) => `${Number(b.width) || 1756} / ${Number(b.height) || 450}`);
  slider.style.aspectRatio = ratios[0];
  dots.innerHTML = list.map((b, i) => `<button type="button" aria-label="Show slide ${i + 1}"></button>`).join("");
  section.hidden = false;
  if (list.length === 1) { slider.classList.add("single"); return; }

  let idx = 0, timer = null;
  const go = (n) => {
    idx = (n + list.length) % list.length;
    track.style.transform = `translateX(-${idx * 100}%)`;
    slider.style.aspectRatio = ratios[idx];
    $$("button", dots).forEach((d, i) => d.setAttribute("aria-current", String(i === idx)));
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => { if (!timer) timer = setInterval(() => go(idx + 1), 3000); }; // auto-slide every 3 s
  $(".sl-prev", slider).addEventListener("click", () => { go(idx - 1); stop(); start(); });
  $(".sl-next", slider).addEventListener("click", () => { go(idx + 1); stop(); start(); });
  dots.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; go([...dots.children].indexOf(b)); stop(); start(); });
  slider.addEventListener("mouseenter", stop);
  slider.addEventListener("mouseleave", start);
  slider.addEventListener("focusin", stop);
  slider.addEventListener("focusout", start);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  // swipe on phones
  let x0 = null, moved = false;
  track.addEventListener("pointerdown", (e) => { x0 = e.clientX; moved = false; });
  track.addEventListener("pointerup", (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { moved = true; go(idx + (dx < 0 ? 1 : -1)); stop(); start(); }
  });
  track.addEventListener("click", (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
  slider.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { go(idx - 1); stop(); }
    if (e.key === "ArrowRight") { go(idx + 1); stop(); }
  });
  go(0);
  start();
}

function init() {
  renderPrograms();
  initExplore();

  $("#qSubject").innerHTML = `<option value="">Select</option><optgroup label="School subjects">${SUBJECTS.map((v) => `<option>${v}</option>`).join("")}</optgroup><optgroup label="Competitive exams">${EXAMS.map((v) => `<option>${v}</option>`).join("")}</optgroup>`;
  fillSelect($("#qClass"), CLASSES, "Select");
  fillSelect($("#studentClass"), CLASSES, "Choose class");
  fillSelect($("#board"), BOARDS, "Choose board");
  fillSelect($("#time"), TIME_SLOTS, "Choose time");
  makeChips($("#subjectChips"), SUBJECTS);
  makeChips($("#examChips"), EXAMS);
  [$("#subjectChips"), $("#examChips")].forEach((box) => box.addEventListener("click", syncClassReq));
  makeChips($("#dayChips"), DAYS);

  const today = new Date();
  const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $("#startDate").min = iso;

  $$('input[name="mode"]').forEach((r) => r.addEventListener("change", syncMode));
  syncMode();
  form().addEventListener("submit", onSubmit);
  form().addEventListener("input", (e) => {
    const f = e.target.closest(".f");
    if (f) f.classList.remove("invalid");
  });
  $("#newBooking").addEventListener("click", resetForm);
  initQuick();
  // non-critical content loads after the page is interactive
  idle(() => { initBanners(); initTutors(); });
}

init();
