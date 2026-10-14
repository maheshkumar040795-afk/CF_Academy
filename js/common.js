// CF Academy — shared website code (home, about, contact):
// header + mobile menu, scroll progress, reveal-on-scroll, count-up numbers,
// contact details from site-config, toast. Page scripts import the helpers.
import { SITE } from "./site-config.js?v=202610141900";

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
      if (/^\s*(call\s+)?[\d\s]{10,12}\s*$/i.test(el.textContent)) el.textContent = el.textContent.replace(/[\d\s]{10,12}\s*$/, fmtTel(p));
    }
    if (k === "wa" && SITE.whatsapp) el.href = "https://wa.me/" + SITE.whatsapp;
    if (k === "wa-float" && SITE.whatsapp) el.href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent("Hello CF Academy, I need a tutor for my child.")}`;
    if (k === "address" && SITE.address) el.textContent = SITE.address;
    if (k === "map" && SITE.mapUrl) { el.href = SITE.mapUrl; el.hidden = false; }
  });
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
}

function init() {
  initMenu();
  initScroll();
  initContact();
  reveal($$(".reveal"));
  initCounts();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
