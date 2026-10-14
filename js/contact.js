// CF Academy — Contact page: office map + parent reviews (read & write)
import { SITE } from "./site-config.js?v=202610141500";
import { listReviews, createReview } from "./db.js?v=202610141500";
import { $, $$, escAttr, toast, reveal, idle } from "./common.js?v=202610141500";

// ── Map: Google Maps embed (no API key needed), loaded only when it nears the screen ──
function initMap() {
  const box = $("#mapWrap");
  if (!box) return;
  const q = SITE.mapLat && SITE.mapLng ? `${SITE.mapLat},${SITE.mapLng}` : encodeURIComponent(SITE.address);
  const add = () => {
    if (box.querySelector("iframe")) return;
    const f = document.createElement("iframe");
    f.src = `https://maps.google.com/maps?q=${q}&z=16&hl=en&output=embed`;
    f.title = "CF Academy office location on Google Maps";
    f.loading = "lazy";
    f.referrerPolicy = "no-referrer-when-downgrade";
    f.allowFullscreen = true;
    box.prepend(f);
  };
  if (!("IntersectionObserver" in window)) return add();
  const obs = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { add(); obs.disconnect(); } }, { rootMargin: "300px" });
  obs.observe(box);
}

// ── Reviews list ──
const PAGE = 6;
let all = [], shown = 0;
const starStr = (n) => "★".repeat(n) + "☆".repeat(5 - n);
const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const ago = (ms) => ms ? new Date(ms).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "";

function card(r) {
  const n = Math.max(1, Math.min(5, Number(r.rating) || 5));
  return `<article class="rv-card reveal">
    <div class="stars" aria-label="${n} out of 5 stars">${starStr(n)}</div>
    <p>${escAttr(r.text)}</p>
    <div class="rv-who"><span class="av" aria-hidden="true">${escAttr(initials(r.name))}</span>
      <div><b>${escAttr(r.name)}</b><small>${[r.place, ago(r.createdAt)].filter(Boolean).map(escAttr).join(" · ")}</small></div></div>
  </article>`;
}
function showMore() {
  const list = $("#rvList");
  const next = all.slice(shown, shown + PAGE);
  list.insertAdjacentHTML("beforeend", next.map(card).join(""));
  shown += next.length;
  $("#rvMoreWrap").hidden = shown >= all.length;
  reveal($$(".reveal", list));
}
async function loadReviews() {
  const list = $("#rvList");
  try { all = await listReviews(); }
  catch (e) { console.warn("Reviews not loaded", e); all = []; }
  list.innerHTML = "";
  shown = 0;
  if (!all.length) {
    list.innerHTML = `<div class="rv-empty">No reviews yet — be the first parent to share your experience.</div>`;
    $("#rvSummary").hidden = true;
    return;
  }
  const avg = all.reduce((s, r) => s + (Number(r.rating) || 0), 0) / all.length;
  const sum = $("#rvSummary");
  sum.innerHTML = `<div class="rv-avg">${avg.toFixed(1)}</div><div><div class="stars" aria-label="Average ${avg.toFixed(1)} out of 5">${starStr(Math.round(avg))}</div><small>Based on ${all.length} parent review${all.length > 1 ? "s" : ""}</small></div>`;
  sum.hidden = false;
  showMore();
}

// ── Write a review ──
const LAST = "cfa_review_sent";
function initForm() {
  const form = $("#rvForm");
  if (!form) return;
  const text = $("#rvText"), count = $("#rvCount");
  text.addEventListener("input", () => { count.textContent = `${text.value.length} / 600`; });
  form.addEventListener("input", (e) => { const f = e.target.closest(".f"); f && f.classList.remove("invalid"); });
  form.addEventListener("change", (e) => { const f = e.target.closest(".f"); f && f.classList.remove("invalid"); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rating = Number((form.querySelector('input[name="rating"]:checked') || {}).value || 0);
    const name = $("#rvName").value.trim(), place = $("#rvPlace").value.trim(), body = text.value.trim();
    let ok = true;
    const mark = (k, bad) => { const f = $(`.f[data-f="${k}"]`, form); f && f.classList.toggle("invalid", bad); if (bad) ok = false; };
    mark("rating", !rating);
    mark("rvName", name.length < 2);
    mark("rvText", body.length < 10);
    if (!ok) { toast("Please fill the highlighted fields."); const first = $(".f.invalid", form); first && first.querySelector("input, textarea").focus(); return; }
    if ($("#rvWebsite").value) return done();                      // bot filled the hidden field
    let last = 0; try { last = Number(localStorage.getItem(LAST) || 0); } catch (err) { /* ignore */ }
    if (Date.now() - last < 12 * 3600e3) { toast("Thanks — you have already sent a review today."); return; }
    const btn = $("#rvSubmit");
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      await createReview({ name, place, rating, text: body });
      try { localStorage.setItem(LAST, String(Date.now())); } catch (err) { /* ignore */ }
      done();
    } catch (err) {
      console.error(err);
      toast("Could not send your review. Please try again.");
    } finally {
      btn.disabled = false; btn.textContent = "Submit review";
    }
  });
  function done() {
    form.hidden = true;
    $("#rvDone").classList.add("show");
  }
}

initMap();
initForm();
idle(loadReviews);
