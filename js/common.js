// CF Academy — shared website code (home, about, contact):
// header + mobile menu, scroll progress, reveal-on-scroll, count-up numbers,
// contact details from site-config, toast. Page scripts import the helpers.
import { SITE } from "./site-config.js?v=202610142500";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escAttr = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ESC[c]);

export const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

export function idle(fn) {
  if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 1500 });
  else setTimeout(fn, 200);
}

let toastTimer = null;
export function toast(msg) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3600);
}

// Fade/slide elements in as they reach the screen. Children of [data-stagger] get a small delay each.
let io = null;
export function reveal(els) {
  const list = (els || []).filter((el) => el && !el.dataset.rv);
  list.forEach((el) => {
    el.dataset.rv = "1";
    const parent = el.parentElement;
    if (parent && parent.hasAttribute("data-stagger") && !el.style.getPropertyValue("--d")) {
      const i = [...parent.children].filter((c) => c.classList.contains("reveal")).indexOf(el);
      el.style.setProperty("--d", Math.min(i, 8) * 80 + "ms");
    }
  });
  if (reduceMotion || !("IntersectionObserver" in window)) { list.forEach((el) => el.classList.add("in")); return; }
  if (!io) {
    io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  }
  list.forEach((el) => io.observe(el));
}

// Count-up numbers: <b data-count="850" data-suffix="+" data-from="0">
function countUp(el) {
  const to = Number(el.dataset.count);
  const from = Number(el.dataset.from || 0);
  const suffix = el.dataset.suffix || "";
  if (!isFinite(to) || reduceMotion) return;
  const t0 = performance.now(), dur = 1300;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = from + suffix;
  requestAnimationFrame(step);
}
function initCounts() {
  const els = $$("[data-count]");
  if (!els.length || reduceMotion || !("IntersectionObserver" in window)) return;
  const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { countUp(e.target); obs.unobserve(e.target); }
  }), { threshold: 0.5 });
  els.forEach((el) => obs.observe(el));
}

// Header shadow, scroll progress bar
function initScroll() {
  const header = $("#siteHeader");
  const bar = $("#progress");
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (header) header.classList.toggle("scrolled", y > 8);
    if (bar) {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    }
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

// Mobile menu
function initMenu() {
  const btn = $(".menu-btn");
  const nav = $("#nav");
  if (!btn || !nav) return;
  const set = (open) => { nav.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); btn.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
  btn.addEventListener("click", () => set(!nav.classList.contains("open")));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { set(false); btn.focus(); } });
  document.addEventListener("click", (e) => { if (nav.classList.contains("open") && !e.target.closest("#nav, .menu-btn")) set(false); });
}

// Phone numbers, WhatsApp, address and map link from site-config.js
const fmtTel = (p) => String(p).replace(/^(\d{5})(\d{5})$/, "$1 $2");
function initContact() {
  const [p1, p2] = SITE.phones || [];
  $$("[data-site]").forEach((el) => {
    const k = el.dataset.site;
    if ((k === "tel1" || k === "tel2") && (k === "tel1" ? p1 : p2)) {
      const p = k === "tel1" ? p1 : p2;
      el.href = "tel:+91" + p;
      // replace a plain number shown as the link text (keeps "Call …" style labels)
      if (/^\s*(call\s+)?[\d\s]{10,12}\s*$/i.test(el.textContent)) el.textContent = el.textContent.replace(/\d[\d\s]{9,11}\s*$/, fmtTel(p));
    }
    if (k === "wa" && SITE.whatsapp) el.href = "https://wa.me/" + SITE.whatsapp;
    if (k === "wa-float" && SITE.whatsapp) el.href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent("Hello CF Academy, I need a tutor for my child.")}`;
    if (k === "address" && SITE.address) el.textContent = SITE.address;
    if (k === "map" && SITE.mapUrl) { el.href = SITE.mapUrl; el.hidden = false; }
  });
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
}

// ── "Become a Tutor": tab on the right edge → form → WhatsApp draft to CF Academy ──
function initBecomeTutor() {
  if ($("#btTab")) return;
  const tab = document.createElement("button");
  tab.type = "button"; tab.id = "btTab"; tab.className = "bt-tab";
  tab.setAttribute("aria-haspopup", "dialog");
  tab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg><span>Become a Tutor</span>';
  const bg = document.createElement("div");
  bg.className = "bt-bg"; bg.hidden = true;
  bg.innerHTML = `
    <div class="bt-box" role="dialog" aria-modal="true" aria-labelledby="btTitle">
      <button type="button" class="bt-x" aria-label="Close">×</button>
      <h2 id="btTitle">Become a Tutor</h2>
      <p class="bt-sub">Join CF Academy's 850+ faculty. Fill in your details and send them to us on WhatsApp.</p>
      <form id="btForm" novalidate>
        <div class="f" data-f="btName"><label for="btName">Tutor name <span class="req">*</span></label><input id="btName" autocomplete="name" maxlength="60"><span class="err-msg">Please enter your name</span></div>
        <div class="f" data-f="btPhone"><label for="btPhone">Contact number <span class="req">*</span></label><input id="btPhone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="18" placeholder="10-digit mobile"><span class="err-msg">Please enter a valid 10-digit mobile number</span></div>
        <div class="f" data-f="btArea"><label for="btArea">Location <span class="req">*</span></label><input id="btArea" maxlength="80" placeholder="e.g. Anna Nagar, Chennai"><span class="err-msg">Please enter your location</span></div>
        <div class="f" data-f="btSubj"><label for="btSubj">Subjects you teach <span class="req">*</span></label><input id="btSubj" maxlength="160" placeholder="e.g. Maths, Physics · Class 9–12 · NEET"><span class="err-msg">Please enter the subjects you teach</span></div>
        <button class="btn btn-wa bt-send" type="submit"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="20" height="20"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>Submit on WhatsApp</button>
        <small class="bt-note">WhatsApp opens with your details drafted — just tap Send.</small>
      </form>
    </div>`;
  document.body.append(tab, bg);
  const form = $("#btForm", bg);
  let last = null;
  const open = () => { last = document.activeElement; bg.hidden = false; document.body.style.overflow = "hidden"; setTimeout(() => $("#btName", bg).focus(), 50); };
  const close = () => { bg.hidden = true; document.body.style.overflow = ""; last && last.focus && last.focus(); };
  tab.addEventListener("click", open);
  $(".bt-x", bg).addEventListener("click", close);
  bg.addEventListener("mousedown", (e) => { if (e.target === bg) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !bg.hidden) close(); });
  form.addEventListener("input", (e) => { const f = e.target.closest(".f"); f && f.classList.remove("invalid"); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (id) => $("#" + id, bg).value.trim();
    let phone = v("btPhone").replace(/\D/g, "");
    if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
    if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
    const bad = { btName: !v("btName"), btPhone: !/^[6-9]\d{9}$/.test(phone), btArea: !v("btArea"), btSubj: !v("btSubj") };
    Object.entries(bad).forEach(([k, b]) => $(`.f[data-f="${k}"]`, bg).classList.toggle("invalid", b));
    const first = Object.keys(bad).find((k) => bad[k]);
    if (first) { $("#" + first, bg).focus(); return; }
    const text = [
      "Hello CF Academy, I would like to join as a tutor.", "",
      `*Tutor name:* ${v("btName")}`,
      `*Contact number:* ${phone}`,
      `*Location:* ${v("btArea")}`,
      `*Subjects:* ${v("btSubj")}`
    ].join("\n");
    const win = window.open(`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`, "_blank");
    try { if (win) win.opener = null; } catch (err) { /* ignore */ }
    form.reset();
    close();
    toast(win ? "Thank you! Please tap Send in WhatsApp." : "Please allow pop-ups to open WhatsApp.");
  });
}

function init() {
  initMenu();
  initScroll();
  initContact();
  reveal($$(".reveal"));
  initCounts();
  initBecomeTutor();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
