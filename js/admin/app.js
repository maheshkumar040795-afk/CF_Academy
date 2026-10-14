// CF Academy admin — app shell: login, navigation, live data
import { isDemo, adminLogin, adminLogout, onAdminAuth, resetPassword, watch, list, resetDemoData, getRole } from "../db.js";
import { $, $$, esc, toast, ICONS } from "./ui.js";
import dashboard from "./dashboard.js";
import bookings from "./bookings.js";
import tutors from "./tutors.js";
import students from "./students.js";
import fees from "./fees.js";
import receipts from "./receipts.js";
import reports from "./reports.js";
import allocation from "./allocation.js";
import staff from "./staff.js";
import banners from "./banners.js";
import webtutors from "./webtutors.js";
import reviews from "./reviews.js";

const ROUTES = { dashboard, bookings, tutors, students, allocation, fees, receipts, reports, reviews, banners, webtutors, staff };
// [route, label, adminOnly]
const NAV = [
  ["dashboard", "Dashboard"], ["bookings", "Bookings / Leads"], ["tutors", "Tutors"],
  ["students", "Students"], ["allocation", "Student Allocation"], ["fees", "Fees"], ["receipts", "Receipts"],
  ["reports", "Reports", true], ["reviews", "Parent Reviews"], ["banners", "Website Banners", true],
  ["webtutors", "Website Tutors", true], ["staff", "Staff Config", true]
];
const allowed = (r) => { const n = NAV.find((x) => x[0] === r); return !!n && (!n[2] || ctx.isAdmin); };

// ── Shared state ──
const subs = new Set();
const ctx = {
  user: null,
  role: null, isAdmin: false,
  bookings: [], students: [], payments: [],
  loaded: { bookings: false, students: false, payments: false },
  tutors: null,
  async ensureTutors(force = false) {
    if (!ctx.tutors || force) {
      ctx.tutors = await list("tutors");
      emit("tutors");
    }
    return ctx.tutors;
  },
  setTutors(arr) { ctx.tutors = arr; emit("tutors"); },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  go(path) { location.hash = "#/" + path; }
};
window.__cfa = ctx; // handy for debugging in the console
function emit(key) { subs.forEach((fn) => fn(key)); }

let unsubs = [];
let current = null;
let seenBookings = null;

function startData() {
  const onErr = (err) => {
    console.error(err);
    toast("Could not load data: " + (err.code === "permission-denied" ? "this account is not an admin (check Firestore rules)." : err.message), "bad");
  };
  ["bookings", "students", "payments"].forEach((col) => {
    watch(col, (rows) => {
      if (col === "bookings") notifyNew(rows);
      ctx[col] = rows;
      ctx.loaded[col] = true;
      emit(col);
      updateNavCounts();
    }, onErr).then((u) => unsubs.push(u));
  });
}
function stopData() {
  unsubs.forEach((u) => u && u());
  unsubs = [];
  ctx.bookings = []; ctx.students = []; ctx.payments = []; ctx.tutors = null;
  seenBookings = null;
}

function notifyNew(rows) {
  const ids = new Set(rows.map((r) => r.id));
  if (seenBookings) {
    const fresh = rows.filter((r) => !seenBookings.has(r.id));
    if (fresh.length) {
      const b = fresh[0];
      toast(`New booking: ${b.parentName || ""} · ${b.subjects || ""} · ${b.area || b.city || ""}`, "ok");
      beep();
    }
  }
  seenBookings = ids;
}

// Short chime for a new booking (works after the admin has clicked once on the page)
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.42);
  } catch (e) { /* audio not allowed */ }
}

function updateNavCounts() {
  const n = ctx.bookings.filter((b) => b.status === "New").length;
  const a = $('#sideNav a[data-r="bookings"]');
  if (a) {
    let c = a.querySelector(".count");
    if (n) {
      if (!c) { c = document.createElement("span"); c.className = "count"; a.appendChild(c); }
      c.textContent = n;
    } else if (c) c.remove();
  }
  document.title = (n ? `(${n}) ` : "") + "CF Academy · Admin";
}

// ── Router ──
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [name, q] = h.split("?");
  const params = Object.fromEntries(new URLSearchParams(q || ""));
  return { name: ROUTES[name] && allowed(name) ? name : "dashboard", params };
}
let routeUnsub = null;
function route() {
  if (!ctx.user) return;
  const { name, params } = parseHash();
  const mod = ROUTES[name];
  $$("#sideNav a").forEach((a) => a.classList.toggle("active", a.dataset.r === name));
  $("#side").classList.remove("open");
  if (current && current.destroy) current.destroy();
  routeUnsub && routeUnsub();
  current = mod;
  const view = $("#view");
  view.innerHTML = "";
  mod.render(view, ctx, params);
  routeUnsub = ctx.subscribe((key) => {
    if (current === mod && (!mod.deps || mod.deps.includes(key))) mod.refresh ? mod.refresh(key) : mod.render(view, ctx, params);
  });
  view.focus && window.scrollTo(0, 0);
}

// ── Auth UI ──
function showLogin() {
  $("#boot").hidden = true;
  $("#appView").hidden = true;
  $("#loginView").hidden = false;
  $("#demoNote").hidden = !isDemo;
  setTimeout(() => $("#lEmail").focus(), 50);
}
function showApp() {
  $("#boot").hidden = true;
  $("#loginView").hidden = true;
  $("#appView").hidden = false;
  $("#demoBar").hidden = !isDemo;
  $("#whoami").textContent = ctx.user.email || "";
  $("#whorole").textContent = ctx.role.role;
  $("#sideNav").innerHTML = NAV.filter((n) => allowed(n[0])).map(([r, label]) => `<a href="#/${r}" data-r="${r}">${ICONS[r]}<span>${esc(label)}</span></a>`).join("");
  startData();
  route();
}

function init() {
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn");
    const err = $("#loginErr");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      await adminLogin($("#lEmail").value.trim(), $("#lPass").value);
    } catch (ex) {
      const code = ex.code || "";
      err.textContent = code.includes("invalid") || code.includes("wrong-password") || code.includes("user-not-found")
        ? "Email or password is incorrect."
        : code.includes("too-many-requests") ? "Too many attempts. Please wait a few minutes." : ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });
  $("#forgotBtn").addEventListener("click", async () => {
    const email = $("#lEmail").value.trim();
    if (!email) { toast("Type your email first, then tap Forgot password.", "bad"); $("#lEmail").focus(); return; }
    try { await resetPassword(email); toast("Password reset link sent to " + email, "ok"); }
    catch (ex) { toast(ex.message, "bad"); }
  });
  $("#logoutBtn").addEventListener("click", () => adminLogout());
  $("#menuToggle").addEventListener("click", () => $("#side").classList.toggle("open"));
  $("#resetDemo").addEventListener("click", () => { resetDemoData(); ctx.tutors = null; toast("Demo data reset.", "ok"); route(); });
  window.addEventListener("hashchange", route);

  $("#myPassBtn").addEventListener("click", async () => {
    try { await resetPassword(ctx.user.email); toast("Password change link sent to " + ctx.user.email, "ok"); }
    catch (ex) { toast(ex.message, "bad"); }
  });

  onAdminAuth(async (user) => {
    const was = ctx.user;
    if (!user) { ctx.user = null; stopData(); showLogin(); return; }
    if (was && was.email === user.email) return;
    const role = await getRole(user);
    if (!role) {
      await adminLogout();
      showLogin();
      const err = $("#loginErr");
      err.textContent = "This account does not have access, or it has been deactivated. Ask the admin to check Staff Config.";
      err.hidden = false;
      return;
    }
    ctx.user = user;
    ctx.role = role;
    ctx.isAdmin = role.role === "Owner" || role.role === "Admin";
    showApp();
  }).catch((e) => {
    $("#boot").textContent = "Could not connect: " + e.message;
  });
}

init();
