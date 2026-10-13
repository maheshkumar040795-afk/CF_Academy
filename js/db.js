// ─────────────────────────────────────────────────────────────
//  CF Academy — data layer
//  One small API used by the website and the admin panel.
//  • Firebase mode: Cloud Firestore + Firebase Auth (when config is filled)
//  • Demo mode:     browser localStorage (when config is empty)
// ─────────────────────────────────────────────────────────────
import { firebaseConfig, APPS_SCRIPT_URL, OWNER_EMAILS, FORCE_DEMO } from "./firebase-config.js";

const FB_CDN = "https://www.gstatic.com/firebasejs/10.12.2/";
export const isDemo = !!FORCE_DEMO || !firebaseConfig.apiKey || !firebaseConfig.projectId;
export const OWNERS = (OWNER_EMAILS || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);

// Collections used: bookings, tutors, students, payments, staff, meta
const WATCH_LIMIT = { bookings: 1000, students: 3000, payments: 6000, staff: 200, banners: 20 };

// ───────────────────────── Firebase ─────────────────────────
let fbPromise = null;
function firebase({ persistent = false, auth = true } = {}) {
  if (!fbPromise) {
    fbPromise = (async () => {
      const [appM, fs, au] = await Promise.all([
        import(FB_CDN + "firebase-app.js"),
        import(FB_CDN + "firebase-firestore.js"),
        auth ? import(FB_CDN + "firebase-auth.js") : Promise.resolve(null)
      ]);
      const app = appM.initializeApp(firebaseConfig);
      let db;
      try {
        db = persistent
          ? fs.initializeFirestore(app, {
              localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
            })
          : fs.getFirestore(app);
      } catch (e) {
        db = fs.getFirestore(app);
      }
      return { app, appM, db, fs, au, auth: au ? au.getAuth(app) : null };
    })();
  }
  return fbPromise;
}

// ───────────────────────── Demo store ─────────────────────────
const KEY = "cfa_demo_v1";
const listeners = new Set();
function demoLoad() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage blocked */ }
  return demoSeed();
}
let demoMem = null;
function store() {
  if (!demoMem) demoMem = demoLoad();
  return demoMem;
}
function demoSave() {
  try { localStorage.setItem(KEY, JSON.stringify(demoMem)); } catch (e) { /* quota or blocked */ }
  listeners.forEach((fn) => fn());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { demoMem = null; listeners.forEach((fn) => fn()); }
  });
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function demoSeed() {
  const now = Date.now();
  const h = 3600e3;
  const s = { bookings: {}, tutors: {}, students: {}, payments: {}, staff: {}, banners: {}, meta: { counters: {} } };
  const sample = [
    { parentName: "Ramesh K", phone: "9840012345", studentName: "Arjun", studentClass: "Class 10", board: "CBSE", subjects: "Mathematics, Science", mode: "Home tuition", area: "Velachery", city: "Chennai", days: "Mon, Wed, Fri", time: "6 – 8 PM", status: "New", createdAt: now - 0.5 * h },
    { parentName: "Lakshmi S", phone: "9790054321", studentName: "Meera", studentClass: "Class 8", board: "State Board", subjects: "Science", mode: "Home tuition", area: "Anna Nagar", city: "Chennai", days: "Tue, Thu", time: "4 – 6 PM", status: "New", createdAt: now - 3.2 * h },
    { parentName: "Imran A", phone: "9944011223", studentName: "Zoya", studentClass: "Class 12", board: "CBSE", subjects: "Chemistry, Physics", mode: "Online tuition", area: "", city: "Coimbatore", days: "Sat, Sun", time: "10 AM – 12 PM", status: "Called", createdAt: now - 26 * h }
  ];
  sample.forEach((b, i) => {
    const id = uid() + i;
    s.bookings[id] = { ...b, id, bookingNo: "CFA-DEMO-" + (101 + i), notes: "Sample booking (demo mode)", source: "website" };
  });
  return s;
}

// ───────────────────────── Helpers ─────────────────────────
const sortDesc = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
function clean(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (k !== "id" && obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

export function makeBookingNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `CFA-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
}

// ───────────────────────── Public website ─────────────────────────
export async function createBooking(b) {
  const data = { ...clean(b), status: "New", createdAt: Date.now(), source: "website" };
  if (isDemo) {
    const s = store();
    const id = uid();
    s.bookings[id] = { ...data, id };
    demoSave();
    return id;
  }
  const { db, fs } = await firebase({ auth: false });
  const ref = await fs.addDoc(fs.collection(db, "bookings"), data);
  return ref.id;
}

// Sends the booking to the Google Sheet (and email) through Apps Script.
export function sendToSheet(b) {
  if (!APPS_SCRIPT_URL) return Promise.resolve(false);
  return fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(b)
  }).then(() => true).catch(() => false);
}

// Active ad banners for the home page slider (max 6), in display order.
export async function listBanners() {
  let rows;
  if (isDemo) rows = Object.values(store().banners || {});
  else {
    const { db, fs } = await firebase({ auth: false });
    const snap = await fs.getDocs(fs.collection(db, "banners"));
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return rows.filter((b) => b.active !== false && b.image)
    .sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 6);
}

// ───────────────────────── Admin auth ─────────────────────────
const DEMO_SESSION = "cfa_demo_admin";
let demoAuthCb = null;

export async function adminLogin(email, password) {
  if (isDemo) {
    const em = String(email || "admin@demo").trim().toLowerCase();
    const st = Object.values(store().staff || {}).find((x) => x.email === em);
    const ok = st ? password === st.demoPassword || password === "demo" : password === "demo";
    if (!ok) throw new Error(st ? "Email or password is incorrect." : "Demo mode: the password is \"demo\".");
    try { sessionStorage.setItem(DEMO_SESSION, em); } catch (e) {}
    demoAuthCb && demoAuthCb({ email: em, uid: st ? st.id : "demo-owner" });
    return;
  }
  const { auth, au } = await firebase({ persistent: true });
  await au.signInWithEmailAndPassword(auth, email, password);
}

export async function adminLogout() {
  if (isDemo) {
    try { sessionStorage.removeItem(DEMO_SESSION); } catch (e) {}
    demoAuthCb && demoAuthCb(null);
    return;
  }
  const { auth, au } = await firebase({ persistent: true });
  await au.signOut(auth);
}

export async function resetPassword(email) {
  if (isDemo) throw new Error("Password reset works after Firebase is connected.");
  const { auth, au } = await firebase({ persistent: true });
  await au.sendPasswordResetEmail(auth, email);
}

export async function onAdminAuth(cb) {
  if (isDemo) {
    demoAuthCb = cb;
    let email = null;
    try { email = sessionStorage.getItem(DEMO_SESSION); } catch (e) {}
    const st = email && Object.values(store().staff || {}).find((x) => x.email === email);
    cb(email ? { email, uid: st ? st.id : "demo-owner" } : null);
    return () => { demoAuthCb = null; };
  }
  const { auth, au } = await firebase({ persistent: true });
  return au.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email, uid: u.uid } : null));
}

// Role of the signed-in user: { role: "Owner" | "Admin" | "Staff", name } or null (no access)
export async function getRole(user) {
  if (!user) return null;
  const email = String(user.email || "").toLowerCase();
  if (isDemo) {
    const st = Object.values(store().staff || {}).find((x) => x.email === email);
    if (!st) return { role: "Owner", name: "Demo owner" };
    return st.active === false ? null : { role: st.role || "Staff", name: st.name || email };
  }
  if (OWNERS.includes(email)) return { role: "Owner", name: email };
  const { db, fs } = await firebase({ persistent: true });
  try {
    const snap = await fs.getDoc(fs.doc(db, "staff", user.uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return d.active === false ? null : { role: d.role || "Staff", name: d.name || email };
  } catch (e) {
    return null;
  }
}

// Creates a staff login (Firebase Auth user) WITHOUT signing the admin out:
// uses a second, temporary Firebase app instance. Returns the new user's uid.
export async function createStaffAccount(email, password) {
  if (isDemo) return "staff" + uid();
  const { appM, au } = await firebase({ persistent: true });
  const name = "staff-creator-" + Date.now();
  const tmp = appM.initializeApp(firebaseConfig, name);
  try {
    const tmpAuth = au.getAuth(tmp);
    const cred = await au.createUserWithEmailAndPassword(tmpAuth, email, password);
    await au.signOut(tmpAuth);
    return cred.user.uid;
  } finally {
    try { await appM.deleteApp(tmp); } catch (e) { /* ignore */ }
  }
}

// ───────────────────────── Admin data ─────────────────────────
// Live list of a collection, newest first. Returns an unsubscribe fn.
export async function watch(col, cb, onError) {
  if (isDemo) {
    const emit = () => cb(Object.values(store()[col] || {}).sort(sortDesc));
    listeners.add(emit);
    emit();
    return () => listeners.delete(emit);
  }
  const { db, fs } = await firebase({ persistent: true });
  const q = fs.query(fs.collection(db, col), fs.orderBy("createdAt", "desc"), fs.limit(WATCH_LIMIT[col] || 2000));
  return fs.onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError && onError(err)
  );
}

// One-time read of a whole collection (used for the 850 tutors).
export async function list(col) {
  if (isDemo) return Object.values(store()[col] || {}).sort(sortDesc);
  const { db, fs } = await firebase({ persistent: true });
  const snap = await fs.getDocs(fs.collection(db, col));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortDesc);
}

// Add (no id) or update (with id). Returns the id.
export async function put(col, obj) {
  const data = clean(obj);
  data.updatedAt = Date.now();
  if (!obj.id && !data.createdAt) data.createdAt = Date.now();
  if (isDemo) {
    const s = store();
    s[col] = s[col] || {};
    const id = obj.id || uid();
    s[col][id] = { ...(s[col][id] || {}), ...data, id };
    demoSave();
    return id;
  }
  const { db, fs } = await firebase({ persistent: true });
  if (obj.id) {
    await fs.setDoc(fs.doc(db, col, obj.id), data, { merge: true });
    return obj.id;
  }
  const ref = await fs.addDoc(fs.collection(db, col), data);
  return ref.id;
}

export async function remove(col, id) {
  if (isDemo) {
    delete store()[col][id];
    demoSave();
    return;
  }
  const { db, fs } = await firebase({ persistent: true });
  await fs.deleteDoc(fs.doc(db, col, id));
}

// Bulk add/update tutors from Excel. rows already validated; each row may
// carry `id` (update) or not (new). Writes in batches of 400.
export async function bulkPut(col, rows, onProgress) {
  const now = Date.now();
  if (isDemo) {
    const s = store();
    s[col] = s[col] || {};
    rows.forEach((r, i) => {
      const id = r.id || uid() + i;
      s[col][id] = { ...(s[col][id] || {}), ...clean(r), id, updatedAt: now, createdAt: (s[col][id] && s[col][id].createdAt) || now - i };
    });
    demoSave();
    onProgress && onProgress(rows.length, rows.length);
    return;
  }
  const { db, fs } = await firebase({ persistent: true });
  const CHUNK = 400;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = fs.writeBatch(db);
    rows.slice(i, i + CHUNK).forEach((r, j) => {
      const data = clean(r);
      data.updatedAt = now;
      if (r.id) {
        batch.set(fs.doc(db, col, r.id), data, { merge: true });
      } else {
        data.createdAt = now - (i + j);
        batch.set(fs.doc(fs.collection(db, col)), data);
      }
    });
    await batch.commit();
    done = Math.min(rows.length, i + CHUNK);
    onProgress && onProgress(done, rows.length);
  }
}

// Next fee receipt number for the financial year: CFA/2026-27/0001
export async function nextReceiptNo(date = new Date()) {
  const y = date.getFullYear();
  const fyStart = date.getMonth() >= 3 ? y : y - 1;
  const fy = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  const field = "receipt_" + fy.replace("-", "_");
  let n;
  if (isDemo) {
    const s = store();
    s.meta = s.meta || { counters: {} };
    s.meta.counters = s.meta.counters || {};
    n = (s.meta.counters[field] || 0) + 1;
    s.meta.counters[field] = n;
    demoSave();
  } else {
    const { db, fs } = await firebase({ persistent: true });
    const ref = fs.doc(db, "meta", "counters");
    n = await fs.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const cur = (snap.exists() && snap.data()[field]) || 0;
      tx.set(ref, { [field]: cur + 1 }, { merge: true });
      return cur + 1;
    });
  }
  return `CFA/${fy}/${String(n).padStart(4, "0")}`;
}

export function resetDemoData() {
  if (!isDemo) return;
  demoMem = demoSeed();
  demoSave();
}
