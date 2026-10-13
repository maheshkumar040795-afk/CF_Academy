// Banners — up to 6 ad slides (1756 × 450) shown on the website above "Our services"
import { put, remove, watch } from "../db.js";
import { $, $$, esc, toast, confirmBox, modal, ICONS } from "./ui.js";

const W = 1756, H = 450, MAX = 6;
const MAX_CHARS = 750000; // keeps each banner well under Firestore's 1 MB document limit
let root, ctx, unsub = null, rows = [], loaded = false;
let pending = null; // { img, name, w, h }

function render(view, c) {
  root = view; ctx = c;
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Website banners</h1><p>Up to ${MAX} slides, ${W} × ${H} px. They play as a slider on the website, just above “Our services”.</p></div>
      <div class="actions"><a class="btn btn-ghost" href="index.html#banners" target="_blank" rel="noopener">View on website</a></div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(300px,420px) minmax(0,1fr);gap:20px;align-items:start" class="bn-grid">
      <form class="panel" id="bnForm" autocomplete="off">
        <h2>Add a slide</h2>
        <div class="note" id="bnLimit" hidden style="margin-bottom:12px"></div>
        <label class="bn-drop" id="bnDrop" for="bnFile">
          <input type="file" id="bnFile" accept="image/png,image/jpeg,image/webp" hidden>
          <span id="bnDropText"><b>Choose an image</b><br><span class="sub" style="display:inline">JPG, PNG or WebP · best at ${W} × ${H} px (other sizes are cropped to fit)</span></span>
          <canvas id="bnCanvas" width="${W}" height="${H}" hidden></canvas>
        </label>
        <div class="fld" id="bnPosWrap" hidden style="margin-top:10px"><label for="bnPos" id="bnPosLbl">Crop position</label><input id="bnPos" type="range" min="0" max="100" value="50"></div>
        <p class="sub" id="bnInfo" style="margin:8px 0 0"></p>
        <div class="form-grid" style="grid-template-columns:1fr;margin-top:12px">
          <div class="fld"><label for="bnTitle">Short description *</label><input id="bnTitle" maxlength="120" placeholder="e.g. Admissions open for 2026–27"><span class="sub">Read out by screen readers and shown if the image fails to load.</span></div>
          <div class="fld"><label for="bnLink">When clicked, go to</label>
            <select id="bnLink"><option value="#book">Book a tutor form</option><option value="">Nothing (image only)</option><option value="custom">Another link…</option></select></div>
          <div class="fld" id="bnUrlWrap" hidden><label for="bnUrl">Link (https://…)</label><input id="bnUrl" type="url" placeholder="https://"></div>
          <label class="check"><input type="checkbox" id="bnActive" checked> Show on website</label>
        </div>
        <button class="btn btn-navy btn-block" type="submit" id="bnSave" style="margin-top:14px;min-height:46px" disabled>Upload slide</button>
      </form>
      <div class="panel">
        <div class="panel-head"><h2>Slides</h2><span class="sub" id="bnCount"></span></div>
        <div id="bnList"></div>
      </div>
    </div>`;
  const mq = window.matchMedia("(max-width: 1000px)");
  const grid = $(".bn-grid", view);
  const apply = () => { grid.style.gridTemplateColumns = mq.matches ? "1fr" : "minmax(300px,420px) minmax(0,1fr)"; };
  apply(); mq.addEventListener && mq.addEventListener("change", apply);

  $("#bnFile", view).addEventListener("change", (e) => e.target.files[0] && loadFile(e.target.files[0]));
  $("#bnPos", view).addEventListener("input", draw);
  $("#bnLink", view).addEventListener("change", (e) => { $("#bnUrlWrap", view).hidden = e.target.value !== "custom"; });
  $("#bnForm", view).addEventListener("submit", save);
  $("#bnList", view).addEventListener("click", onListClick);
  const drop = $("#bnDrop", view);
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; f && loadFile(f); });

  loaded = false;
  renderList();
  watch("banners", (r) => { rows = r.sort((a, b) => (a.order || 0) - (b.order || 0)); loaded = true; renderList(); },
    (err) => { $("#bnList", root).innerHTML = `<div class="note bad">Could not load banners: ${esc(err.message)}</div>`; })
    .then((u) => { unsub = u; });
}

function loadFile(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast("Please choose a JPG, PNG or WebP image", "bad"); return; }
  if (file.size > 15 * 1024 * 1024) { toast("That image is over 15 MB — please use a smaller one", "bad"); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    pending = { img, name: file.name, w: img.naturalWidth, h: img.naturalHeight };
    const ratio = img.naturalWidth / img.naturalHeight;
    const target = W / H;
    const posWrap = $("#bnPosWrap", root);
    posWrap.hidden = Math.abs(ratio - target) < 0.02;
    $("#bnPosLbl", root).textContent = ratio > target ? "Crop position (left ↔ right)" : "Crop position (top ↕ bottom)";
    $("#bnPos", root).value = 50;
    $("#bnCanvas", root).hidden = false;
    $("#bnDropText", root).hidden = true;
    const exact = img.naturalWidth === W && img.naturalHeight === H;
    $("#bnInfo", root).innerHTML = `${esc(file.name)} · ${img.naturalWidth} × ${img.naturalHeight} px` +
      (exact ? " · perfect size" : img.naturalWidth < W * 0.7 ? ` · <span style="color:var(--err)">small image — it may look blurry on large screens</span>` : posWrap.hidden ? " · resized to fit" : " · cropped to fit (drag the slider to adjust)");
    if (!$("#bnTitle", root).value) $("#bnTitle", root).value = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 120);
    $("#bnSave", root).disabled = rows.length >= MAX;
    draw();
    URL.revokeObjectURL(url);
  };
  img.onerror = () => toast("Could not read that image", "bad");
  img.src = url;
}

// Cover-crop the image into the 1756 × 450 canvas
function draw() {
  if (!pending) return;
  const cv = $("#bnCanvas", root);
  const c2 = cv.getContext("2d");
  const { img, w, h } = pending;
  const scale = Math.max(W / w, H / h);
  const sw = W / scale, sh = H / scale;
  const pos = Number($("#bnPos", root).value) / 100;
  const sx = (w - sw) * pos, sy = (h - sh) * pos;
  c2.fillStyle = "#fff";
  c2.fillRect(0, 0, W, H);
  c2.imageSmoothingQuality = "high";
  c2.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

function encode() {
  const cv = $("#bnCanvas", root);
  for (const q of [0.85, 0.78, 0.7, 0.62, 0.55]) {
    let d = cv.toDataURL("image/webp", q);
    if (!d.startsWith("data:image/webp")) d = cv.toDataURL("image/jpeg", q); // browsers without WebP encoding
    if (d.length <= MAX_CHARS) return d;
  }
  return null;
}

async function save(e) {
  e.preventDefault();
  if (!pending) { toast("Choose an image first", "bad"); return; }
  if (rows.length >= MAX) { toast(`Maximum ${MAX} slides — delete one first`, "bad"); return; }
  const title = $("#bnTitle", root).value.trim();
  if (!title) { toast("Add a short description", "bad"); $("#bnTitle", root).focus(); return; }
  let link = $("#bnLink", root).value;
  if (link === "custom") {
    link = $("#bnUrl", root).value.trim();
    if (!/^https?:\/\//i.test(link)) { toast("Enter a full link starting with https://", "bad"); return; }
  }
  const image = encode();
  if (!image) { toast("Image is too detailed to store — try a simpler or smaller image", "bad"); return; }
  const btn = $("#bnSave", root);
  btn.disabled = true; btn.textContent = "Uploading…";
  try {
    const order = rows.length ? Math.max(...rows.map((r) => r.order || 0)) + 1 : 1;
    await put("banners", { title, link, active: $("#bnActive", root).checked, order, image, width: W, height: H, sizeKB: Math.round(image.length * 0.75 / 1024), uploadedBy: ctx.user.email });
    toast("Slide uploaded", "ok");
    resetForm();
  } catch (ex) {
    toast("Upload failed: " + ex.message, "bad");
  } finally {
    btn.textContent = "Upload slide";
    btn.disabled = !pending || rows.length >= MAX;
  }
}

function resetForm() {
  pending = null;
  $("#bnForm", root).reset();
  $("#bnCanvas", root).hidden = true;
  $("#bnDropText", root).hidden = false;
  $("#bnPosWrap", root).hidden = true;
  $("#bnUrlWrap", root).hidden = true;
  $("#bnInfo", root).textContent = "";
  $("#bnSave", root).disabled = true;
}

function renderList() {
  const box = $("#bnList", root);
  if (!box) return;
  if (!loaded) { box.innerHTML = `<p class="sub">Loading…</p>`; return; }
  const live = rows.filter((r) => r.active !== false).length;
  $("#bnCount", root).textContent = `${rows.length} of ${MAX} · ${live} showing on website`;
  const lim = $("#bnLimit", root);
  lim.hidden = rows.length < MAX;
  lim.className = "note warn";
  lim.textContent = `You have ${MAX} slides — the maximum. Delete one to add another.`;
  if (rows.length >= MAX) $("#bnSave", root).disabled = true;
  box.innerHTML = rows.length ? rows.map((r, i) => `
    <div class="bn-item ${r.active === false ? "off" : ""}">
      <img src="${esc(r.image)}" alt="${esc(r.title)}" loading="lazy">
      <div class="bn-meta">
        <div><b>${i + 1}. ${esc(r.title)}</b>
          <span class="sub">${r.link ? "Opens: " + esc(r.link === "#book" ? "Book a tutor form" : r.link) : "No link"} · ${esc(r.sizeKB || "")} KB</span></div>
        <div class="bn-actions">
          <span class="pill ${r.active === false ? "p-lost" : "p-won"}">${r.active === false ? "Hidden" : "Live"}</span>
          <button class="btn btn-ghost btn-sm" data-act="up" data-id="${esc(r.id)}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
          <button class="btn btn-ghost btn-sm" data-act="down" data-id="${esc(r.id)}" ${i === rows.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
          <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${esc(r.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-act="toggle" data-id="${esc(r.id)}">${r.active === false ? "Show" : "Hide"}</button>
          <button class="btn btn-danger btn-sm" data-act="del" data-id="${esc(r.id)}">Delete</button>
        </div>
      </div>
    </div>`).join("") : `<div class="empty">No slides yet. While there are none, the banner area is hidden on the website.</div>`;
}

async function onListClick(e) {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const i = rows.findIndex((x) => x.id === b.dataset.id); if (i < 0) return;
  const r = rows[i];
  try {
    if (b.dataset.act === "toggle") { await put("banners", { id: r.id, active: r.active === false }); }
    if (b.dataset.act === "up" || b.dataset.act === "down") {
      const j = b.dataset.act === "up" ? i - 1 : i + 1;
      const other = rows[j]; if (!other) return;
      const oa = r.order || i + 1, ob = other.order || j + 1;
      await Promise.all([put("banners", { id: r.id, order: ob === oa ? j + 1 : ob }), put("banners", { id: other.id, order: ob === oa ? i + 1 : oa })]);
    }
    if (b.dataset.act === "del") {
      if (!(await confirmBox("Delete slide?", `Delete “${esc(r.title)}”? It disappears from the website immediately.`, "Delete"))) return;
      await remove("banners", r.id);
      toast("Slide deleted");
    }
    if (b.dataset.act === "edit") editSlide(r);
  } catch (ex) { toast(ex.message, "bad"); }
}

function editSlide(r) {
  const isCustom = r.link && r.link !== "#book";
  modal({
    title: "Edit slide",
    body: `<img src="${esc(r.image)}" alt="" style="width:100%;border-radius:8px;aspect-ratio:${W}/${H};object-fit:cover;margin-bottom:12px">
      <div class="form-grid" style="grid-template-columns:1fr" id="beForm">
        <div class="fld"><label>Short description</label><input name="title" maxlength="120" value="${esc(r.title)}"></div>
        <div class="fld"><label>When clicked, go to</label><select name="linkType"><option value="#book" ${r.link === "#book" ? "selected" : ""}>Book a tutor form</option><option value="" ${!r.link ? "selected" : ""}>Nothing (image only)</option><option value="custom" ${isCustom ? "selected" : ""}>Another link…</option></select></div>
        <div class="fld"><label>Link (only for “Another link”)</label><input name="url" type="url" value="${esc(isCustom ? r.link : "")}" placeholder="https://"></div>
      </div>`,
    actions: [{ label: "Cancel" }, { label: "Save", kind: "btn-navy", onClick: async (close, m) => {
      const title = $('[name="title"]', m).value.trim();
      let link = $('[name="linkType"]', m).value;
      if (link === "custom") { link = $('[name="url"]', m).value.trim(); if (!/^https?:\/\//i.test(link)) { toast("Enter a full link starting with https://", "bad"); return false; } }
      if (!title) { toast("Description is required", "bad"); return false; }
      await put("banners", { id: r.id, title, link });
      toast("Saved", "ok");
    } }]
  });
}

function destroy() { unsub && unsub(); unsub = null; pending = null; }

export default { deps: [], render, refresh() {}, destroy };
