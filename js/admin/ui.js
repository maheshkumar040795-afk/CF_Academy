// Shared UI helpers for the admin panel
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ESC[c]);

export function normPhone(p) {
  let d = String(p == null ? "" : p).replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}
export const fmtPhone = (p) => { const d = normPhone(p); return d.length === 10 ? d.slice(0, 5) + " " + d.slice(5) : d; };

export function inr(n) {
  const v = Number(n) || 0;
  return "₹ " + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
export function fmtDate(v) {
  if (!v) return "";
  let d;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, dd] = v.split("-").map(Number); d = new Date(y, m - 1, dd); }
  else d = new Date(v);
  return isNaN(d) ? "" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const t = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return "Today, " + t;
  if (d.toDateString() === y.toDateString()) return "Yesterday, " + t;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + t;
}
export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function monthKey(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
export function lastMonths(n, from = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)));
  return out;
}

export function waLink(phone, text) {
  const d = normPhone(phone);
  return `https://wa.me/91${d}?text=${encodeURIComponent(text || "")}`;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

// Simple modal. body = html string. actions = [{label, kind, onClick(close, root) -> false to keep open}]
export function modal({ title, body, actions = [], wide = false, onOpen }) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `
    <div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-h"><h2>${esc(title)}</h2><button class="modal-x" type="button" aria-label="Close">×</button></div>
      <div class="modal-b">${body}</div>
      ${actions.length ? `<div class="modal-f">${actions.map((a, i) => `<button type="button" class="btn ${a.kind || "btn-ghost"}" data-i="${i}">${esc(a.label)}</button>`).join("")}</div>` : ""}
    </div>`;
  const prevFocus = document.activeElement;
  const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); prevFocus && prevFocus.focus && prevFocus.focus(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  bg.addEventListener("mousedown", (e) => { if (e.target === bg) close(); });
  bg.querySelector(".modal-x").addEventListener("click", close);
  bg.querySelectorAll(".modal-f [data-i]").forEach((b) => b.addEventListener("click", async () => {
    const a = actions[Number(b.dataset.i)];
    if (!a.onClick) return close();
    b.disabled = true;
    try {
      const keep = await a.onClick(close, bg);
      if (keep !== false) close();
    } finally { b.disabled = false; }
  }));
  document.addEventListener("keydown", onKey);
  document.body.appendChild(bg);
  const first = bg.querySelector(".modal-b input, .modal-b select, .modal-b textarea, .modal-f .btn");
  first && first.focus();
  onOpen && onOpen(bg, close);
  return { root: bg, close };
}

export function confirmBox(title, message, okLabel = "Yes, continue", danger = true) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title,
      body: `<p style="margin:0">${message}</p>`,
      actions: [
        { label: "Cancel", kind: "btn-ghost", onClick: () => { done = true; resolve(false); } },
        { label: okLabel, kind: danger ? "btn-danger" : "btn-navy", onClick: () => { done = true; resolve(true); } }
      ]
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.root)) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe(document.body, { childList: true });
  });
}

// Reads all [name] fields inside a root into an object
export function readFields(root) {
  const o = {};
  $$("[name]", root).forEach((el) => {
    if (el.type === "checkbox") o[el.name] = el.checked;
    else o[el.name] = el.value.trim();
  });
  return o;
}

export function options(items, selected, placeholder) {
  return (placeholder != null ? `<option value="">${esc(placeholder)}</option>` : "") +
    items.map((v) => `<option ${String(v) === String(selected) ? "selected" : ""}>${esc(v)}</option>`).join("");
}

// Excel export with SheetJS (loaded in admin.html)
export function exportXlsx(sheets, filename) {
  if (!window.XLSX) { toast("Excel library is still loading — try again in a moment.", "bad"); return; }
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "No data" }]);
    const keys = Object.keys(rows[0] || {});
    ws["!cols"] = keys.map((k) => ({ wch: Math.min(40, Math.max(k.length + 2, ...rows.slice(0, 200).map((r) => String(r[k] == null ? "" : r[k]).length + 1))) }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

// Indian-style amount in words: 125000 → "One Lakh Twenty Five Thousand"
export function amountInWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : ""));
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x));
  const parts = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thou = Math.floor((n % 1e5) / 1e3), rest = n % 1000;
  if (crore) parts.push(three(crore) + " Crore");
  if (lakh) parts.push(two(lakh) + " Lakh");
  if (thou) parts.push(two(thou) + " Thousand");
  if (rest) parts.push(three(rest));
  return parts.join(" ");
}

export const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  bookings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 15h3"/></svg>',
  tutors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>',
  students: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16.5 14.6c2.3.2 4.3 1.9 5 5.4"/></svg>',
  fees: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h11M7 9h11M7 4c4 0 5 2 5 5s-2 5-5 5l7 6"/></svg>',
  receipts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  allocation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M8.5 7H14a3 3 0 0 1 3 3v4.5"/><path d="M14.5 12.5l2.5 2.5 2.5-2.5"/></svg>',
  banners: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="11" r="1.6"/><path d="M22 15l-5-4-7 6"/></svg>',
  staff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.5"/></svg>',
  reviews: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.4 6.7 19.3l1.1-5.9L3.4 9.3l6-.8z"/></svg>',
  webtutors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2.5"/><path d="M5 17c.6-2 2.2-3 4-3s3.4 1 4 3M15 9h3M15 13h3"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2-.2-.1-.4-.2z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M7 14l5-5 5 5M4 3h16"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/></svg>'
};
