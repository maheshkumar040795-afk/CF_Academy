// Parent reviews — written on the website's Contact page; shown there only after approval
import { put, remove, watch } from "../db.js";
import { $, $$, esc, toast, confirmBox, fmtDateTime } from "./ui.js";

let root, ctx, unsub = null, rows = [], loaded = false, tab = "pending";

const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

function render(view, c) {
  root = view; ctx = c;
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Parent reviews</h1><p>Parents write reviews on the website's Contact page. A review shows on the website only after you approve it.</p></div>
      <div class="actions"><a class="btn btn-ghost" href="contact.html#reviews" target="_blank" rel="noopener">View on website</a></div>
    </div>
    <div class="tabs" id="rvTabs" role="tablist">
      <button type="button" class="tab" data-t="pending">Waiting for approval <span class="c" id="rvPendingN"></span></button>
      <button type="button" class="tab" data-t="approved">On website <span class="c" id="rvApprovedN"></span></button>
      <button type="button" class="tab" data-t="all">All</button>
    </div>
    <div class="panel" id="rvList"></div>`;
  $("#rvTabs", view).addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) { tab = b.dataset.t; renderList(); } });
  $("#rvList", view).addEventListener("click", onClick);
  loaded = false;
  renderList();
  watch("reviews", (r) => { rows = r; loaded = true; renderList(); },
    (err) => { $("#rvList", root).innerHTML = `<div class="note bad">Could not load reviews: ${esc(err.message)}</div>`; })
    .then((u) => { unsub = u; });
}

function renderList() {
  const box = $("#rvList", root);
  if (!box) return;
  $$("#rvTabs [data-t]", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === tab)));
  if (!loaded) { box.innerHTML = `<p class="sub">Loading…</p>`; return; }
  const pend = rows.filter((r) => r.approved !== true).length;
  $("#rvPendingN", root).textContent = pend ? "(" + pend + ")" : "";
  $("#rvApprovedN", root).textContent = "(" + (rows.length - pend) + ")";
  const list = rows.filter((r) => tab === "all" || (tab === "approved" ? r.approved === true : r.approved !== true));
  box.innerHTML = list.length ? list.map((r) => `
    <article class="rv-item">
      <div class="rv-top">
        <div><b>${esc(r.name)}</b>${r.place ? ` <span class="sub">· ${esc(r.place)}</span>` : ""}
          <div class="rv-stars" aria-label="${Number(r.rating) || 0} out of 5">${stars(Number(r.rating) || 0)}</div></div>
        <span class="pill ${r.approved === true ? "p-won" : "p-new"}">${r.approved === true ? "On website" : "Waiting"}</span>
      </div>
      <p class="rv-text">${esc(r.text)}</p>
      <div class="rv-foot">
        <span class="sub">${esc(fmtDateTime(r.createdAt))}</span>
        <div class="rv-actions">
          ${r.approved === true
            ? `<button class="btn btn-ghost btn-sm" data-act="hide" data-id="${esc(r.id)}">Remove from website</button>`
            : `<button class="btn btn-navy btn-sm" data-act="approve" data-id="${esc(r.id)}">Approve &amp; show</button>`}
          ${ctx.isAdmin ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${esc(r.id)}">Delete</button>` : ""}
        </div>
      </div>
    </article>`).join("")
    : `<div class="empty">${tab === "pending" ? "No reviews waiting. New reviews from the website appear here." : "No reviews here yet."}</div>`;
}

async function onClick(e) {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const r = rows.find((x) => x.id === b.dataset.id); if (!r) return;
  try {
    if (b.dataset.act === "approve") { await put("reviews", { id: r.id, approved: true, approvedBy: ctx.user.email }); toast("Review approved — it now shows on the website", "ok"); }
    if (b.dataset.act === "hide") { await put("reviews", { id: r.id, approved: false }); toast("Review removed from the website"); }
    if (b.dataset.act === "del") {
      if (!(await confirmBox("Delete review?", `Delete the review from “${esc(r.name)}”? This cannot be undone.`, "Delete"))) return;
      await remove("reviews", r.id); toast("Review deleted");
    }
  } catch (ex) { toast(ex.message, "bad"); }
}

function destroy() { unsub && unsub(); unsub = null; }

export default { deps: [], render, refresh() {}, destroy };
