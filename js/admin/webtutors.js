// Website Tutors — the 10 "Meet our tutors" cards on the website (photo, name, experience)
import { put, remove, watch } from "../db.js";
import { $, esc, toast, confirmBox } from "./ui.js";
import { cloudinaryReady, uploadImage, canvasBlob, cld } from "../cloudinary.js";

const MAX = 10, SIDE = 600; // photos are cropped square, 600 × 600
let root, ctx, unsub = null, rows = [], loaded = false;
let pending = null;   // { img, w, h }
let editing = null;   // record being edited

const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function render(view, c) {
  root = view; ctx = c;
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Website tutors</h1><p>Up to ${MAX} tutor cards in “Meet our tutors” on the website — photo, name and experience.</p>
        <p class="sub" style="margin-top:4px">${cloudinaryReady ? "Photos are uploaded to Cloudinary." : "Cloudinary is not set up yet — photos are compressed and saved in Firestore. See README → Cloudinary."}</p></div>
      <div class="actions"><a class="btn btn-ghost" href="index.html#tutors" target="_blank" rel="noopener">View on website</a></div>
    </div>
    <div class="wt-grid">
      <form class="panel" id="wtForm" autocomplete="off">
        <h2 id="wtFormTitle">Add a tutor</h2>
        <div class="note warn" id="wtLimit" hidden style="margin-bottom:12px"></div>
        <div class="wt-photo-row">
          <label class="wt-drop" for="wtFile" title="Choose photo">
            <input type="file" id="wtFile" accept="image/png,image/jpeg,image/webp" hidden>
            <canvas id="wtCanvas" width="${SIDE}" height="${SIDE}" hidden></canvas>
            <img id="wtCurrent" alt="" hidden>
            <span id="wtDropText">+ Photo</span>
          </label>
          <div style="flex:1;min-width:0">
            <p class="sub" style="margin:0 0 8px">Square photo works best (face in the centre). JPG, PNG or WebP. Optional — without a photo the card shows initials.</p>
            <div class="fld" id="wtPosWrap" hidden><label for="wtPos" id="wtPosLbl">Crop position</label><input id="wtPos" type="range" min="0" max="100" value="50"></div>
            <button type="button" class="link-btn" id="wtClearPhoto" hidden>Remove photo</button>
          </div>
        </div>
        <div class="form-grid" style="grid-template-columns:1fr;margin-top:14px">
          <div class="fld"><label for="wtName">Tutor name *</label><input id="wtName" maxlength="40" placeholder="e.g. Priya Raman"></div>
          <div class="fld"><label for="wtExp">Experience *</label><input id="wtExp" maxlength="20" placeholder="e.g. 12 yrs"></div>
          <div class="fld"><label for="wtSubj">Subject / classes (optional)</label><input id="wtSubj" maxlength="40" placeholder="e.g. Maths · Class 6–10"></div>
          <label class="check"><input type="checkbox" id="wtActive" checked> Show on website</label>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px">
          <button class="btn btn-navy" style="flex:1;min-height:46px" type="submit" id="wtSave">Add tutor</button>
          <button class="btn btn-ghost" type="button" id="wtCancel" hidden>Cancel</button>
        </div>
      </form>
      <div class="panel">
        <div class="panel-head"><h2>Tutor cards</h2><span class="sub" id="wtCount"></span></div>
        <div id="wtList"></div>
      </div>
    </div>`;

  $("#wtFile", view).addEventListener("change", (e) => { e.target.files[0] && loadFile(e.target.files[0]); e.target.value = ""; });
  $("#wtPos", view).addEventListener("input", draw);
  $("#wtForm", view).addEventListener("submit", save);
  $("#wtCancel", view).addEventListener("click", resetForm);
  $("#wtClearPhoto", view).addEventListener("click", () => {
    pending = null; if (editing) editing._clearPhoto = true;
    showPhoto(null);
  });
  $("#wtList", view).addEventListener("click", onListClick);

  loaded = false;
  renderList();
  watch("featuredTutors", (r) => { rows = r.sort((a, b) => (a.order || 0) - (b.order || 0)); loaded = true; renderList(); },
    (err) => { $("#wtList", root).innerHTML = `<div class="note bad">Could not load: ${esc(err.message)}</div>`; })
    .then((u) => { unsub = u; });
}

function showPhoto(url) {
  const cur = $("#wtCurrent", root), cv = $("#wtCanvas", root);
  cv.hidden = !pending;
  cur.hidden = !!pending || !url;
  if (url) cur.src = cld(url, 240);
  $("#wtDropText", root).hidden = !!pending || !!url;
  $("#wtPosWrap", root).hidden = !pending || Math.abs(pending.w - pending.h) < 4;
  $("#wtClearPhoto", root).hidden = !pending && !url;
}

function loadFile(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast("Please choose a JPG, PNG or WebP image", "bad"); return; }
  if (file.size > 15 * 1024 * 1024) { toast("That image is over 15 MB — please use a smaller one", "bad"); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    pending = { img, w: img.naturalWidth, h: img.naturalHeight };
    $("#wtPosLbl", root).textContent = pending.w > pending.h ? "Crop position (left ↔ right)" : "Crop position (top ↕ bottom)";
    $("#wtPos", root).value = pending.w > pending.h ? 50 : 25; // portraits: keep the face (upper part)
    showPhoto(null);
    draw();
    URL.revokeObjectURL(url);
  };
  img.onerror = () => toast("Could not read that image", "bad");
  img.src = url;
}

function draw() {
  if (!pending) return;
  const cv = $("#wtCanvas", root), c2 = cv.getContext("2d");
  const { img, w, h } = pending;
  const s = Math.min(w, h);
  const pos = Number($("#wtPos", root).value) / 100;
  c2.fillStyle = "#fff"; c2.fillRect(0, 0, SIDE, SIDE);
  c2.imageSmoothingQuality = "high";
  c2.drawImage(img, (w - s) * pos, (h - s) * pos, s, s, 0, 0, SIDE, SIDE);
}

async function photoValue() {
  const cv = $("#wtCanvas", root);
  if (cloudinaryReady) {
    const up = await uploadImage(await canvasBlob(cv, 0.9), "tutors");
    return { photo: up.url, publicId: up.publicId };
  }
  // fallback: small WebP/JPEG stored in Firestore (~30–60 KB)
  const small = document.createElement("canvas");
  small.width = small.height = 360;
  small.getContext("2d").drawImage(cv, 0, 0, 360, 360);
  let d = small.toDataURL("image/webp", 0.8);
  if (!d.startsWith("data:image/webp")) d = small.toDataURL("image/jpeg", 0.8);
  return { photo: d, publicId: "" };
}

async function save(e) {
  e.preventDefault();
  const name = $("#wtName", root).value.trim();
  const experience = $("#wtExp", root).value.trim();
  if (!name) { toast("Enter the tutor's name", "bad"); $("#wtName", root).focus(); return; }
  if (!experience) { toast("Enter the experience (e.g. 12 yrs)", "bad"); $("#wtExp", root).focus(); return; }
  if (!editing && rows.length >= MAX) { toast(`Maximum ${MAX} tutor cards — delete one first`, "bad"); return; }
  const btn = $("#wtSave", root);
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    const data = { name, experience, subject: $("#wtSubj", root).value.trim(), active: $("#wtActive", root).checked };
    if (pending) Object.assign(data, await photoValue());
    else if (editing && editing._clearPhoto) Object.assign(data, { photo: "", publicId: "" });
    if (editing) data.id = editing.id;
    else { data.order = rows.length ? Math.max(...rows.map((r) => r.order || 0)) + 1 : 1; data.photo = data.photo || ""; data.addedBy = ctx.user.email; }
    await put("featuredTutors", data);
    toast(editing ? "Tutor card updated" : "Tutor card added", "ok");
    resetForm();
  } catch (ex) {
    toast("Save failed: " + ex.message, "bad");
  } finally {
    btn.disabled = false;
    btn.textContent = editing ? "Save changes" : "Add tutor";
  }
}

function resetForm() {
  pending = null; editing = null;
  $("#wtForm", root).reset();
  $("#wtFormTitle", root).textContent = "Add a tutor";
  $("#wtSave", root).textContent = "Add tutor";
  $("#wtCancel", root).hidden = true;
  showPhoto(null);
  renderList();
}

function startEdit(r) {
  pending = null; editing = { ...r };
  $("#wtFormTitle", root).textContent = "Edit tutor";
  $("#wtSave", root).textContent = "Save changes";
  $("#wtCancel", root).hidden = false;
  $("#wtName", root).value = r.name || "";
  $("#wtExp", root).value = r.experience || "";
  $("#wtSubj", root).value = r.subject || "";
  $("#wtActive", root).checked = r.active !== false;
  showPhoto(r.photo || null);
  $("#wtLimit", root).hidden = true;
  $("#wtForm", root).scrollIntoView({ behavior: "smooth", block: "start" });
  $("#wtName", root).focus({ preventScroll: true });
}

function renderList() {
  const box = $("#wtList", root);
  if (!box) return;
  if (!loaded) { box.innerHTML = `<p class="sub">Loading…</p>`; return; }
  const live = rows.filter((r) => r.active !== false).length;
  $("#wtCount", root).textContent = `${rows.length} of ${MAX} · ${live} showing on website`;
  const lim = $("#wtLimit", root);
  lim.hidden = editing || rows.length < MAX;
  lim.textContent = `You have ${MAX} tutor cards — the maximum. Delete one to add another, or edit an existing card.`;
  box.innerHTML = rows.length ? `<div class="wt-cards">${rows.map((r, i) => `
    <div class="wt-card ${r.active === false ? "off" : ""}">
      <div class="wt-av">${r.photo ? `<img src="${esc(cld(r.photo, 160))}" alt="" loading="lazy">` : `<span>${esc(initials(r.name))}</span>`}</div>
      <div class="wt-info"><b>${i + 1}. ${esc(r.name)}</b><span>${esc(r.experience || "")}${r.subject ? " · " + esc(r.subject) : ""}</span>
        <span class="pill ${r.active === false ? "p-lost" : "p-won"}" style="align-self:flex-start;margin-top:4px">${r.active === false ? "Hidden" : "Live"}</span></div>
      <div class="wt-actions">
        <button class="btn btn-ghost btn-sm" data-act="up" data-id="${esc(r.id)}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
        <button class="btn btn-ghost btn-sm" data-act="down" data-id="${esc(r.id)}" ${i === rows.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
        <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${esc(r.id)}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-act="toggle" data-id="${esc(r.id)}">${r.active === false ? "Show" : "Hide"}</button>
        <button class="btn btn-danger btn-sm" data-act="del" data-id="${esc(r.id)}">Delete</button>
      </div>
    </div>`).join("")}</div>` : `<div class="empty">No tutor cards yet. While there are none, “Meet our tutors” is hidden on the website.</div>`;
}

async function onListClick(e) {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const i = rows.findIndex((x) => x.id === b.dataset.id); if (i < 0) return;
  const r = rows[i];
  try {
    if (b.dataset.act === "edit") return startEdit(r);
    if (b.dataset.act === "toggle") await put("featuredTutors", { id: r.id, active: r.active === false });
    if (b.dataset.act === "up" || b.dataset.act === "down") {
      const j = b.dataset.act === "up" ? i - 1 : i + 1;
      const other = rows[j]; if (!other) return;
      const oa = r.order || i + 1, ob = other.order || j + 1;
      await Promise.all([put("featuredTutors", { id: r.id, order: ob === oa ? j + 1 : ob }), put("featuredTutors", { id: other.id, order: ob === oa ? i + 1 : oa })]);
    }
    if (b.dataset.act === "del") {
      if (!(await confirmBox("Delete tutor card?", `Delete the card for “${esc(r.name)}”? It disappears from the website immediately.`, "Delete"))) return;
      await remove("featuredTutors", r.id);
      if (editing && editing.id === r.id) resetForm();
      toast("Tutor card deleted");
    }
  } catch (ex) { toast(ex.message, "bad"); }
}

function destroy() { unsub && unsub(); unsub = null; pending = null; editing = null; }

export default { deps: [], render, refresh() {}, destroy };
