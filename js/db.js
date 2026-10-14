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

// Collections used: bookings, tutors, students, payments, staff, meta, banners, featuredTutors, reviews
const WATCH_LIMIT = { bookings: 1000, students: 3000, payments: 6000, staff: 200, banners: 20, featuredTutors: 30, reviews: 500 };

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
  const s = { bookings: {}, tutors: {}, students: {}, payments: {}, staff: {}, banners: {}, featuredTutors: {}, reviews: {}, meta: { counters: {} } };
  // sample "Meet our tutors" cards (replace from Admin → Website Tutors)
  [["Priya Raman", "12 yrs", "Maths · Class 6–10"], ["Karthik S", "9 yrs", "Physics · Class 11–12"], ["Divya Narayanan", "15 yrs", "English · All classes"],
   ["Arun Kumar", "8 yrs", "Chemistry · NEET / JEE"], ["Meena Lakshmi", "11 yrs", "Primary · LKG–Class 5"], ["Suresh Babu", "17 yrs", "Accountancy · Class 11–12"],
   ["Fathima Begum", "7 yrs", "Hindi · Class 1–10"], ["Vignesh R", "10 yrs", "Computer Science"], ["Kavitha M", "13 yrs", "Biology · Class 9–12"], ["Rajesh P", "14 yrs", "Tamil · All boards"]]
    .forEach(([name, experience, subject], i) => { const id = "ft" + i; s.featuredTutors[id] = { id, name, experience, subject, photo: "", active: true, order: i + 1, createdAt: now - i }; });
  [["Ramesh K", "Velachery", 5, "Our son's maths marks went from 58 to 91 in one term. The tutor is patient and very regular."],
   ["Lakshmi S", "Anna Nagar", 5, "They found a home tutor near us within two days. Very professional team."],
   ["Imran A", "Coimbatore", 4, "Online chemistry classes are clear and well planned. Good follow-up from the office."]]
    .forEach(([name, place, rating, text], i) => { const id = "rv" + i; s.reviews[id] = { id, name, place, rating, text, approved: true, createdAt: now - (i + 1) * 86400e3 }; });
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
// The public pages never load the Firebase SDK (≈300 KB). They use the tiny
// Firestore REST API instead — same security rules, much faster page load.
const REST = () => `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
  return { stringValue: String(v) };
}
function fromFs(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFs);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  return null;
}
const fromDoc = (d) => ({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFs(v)])) });
async function restCreate(col, data) {
  const r = await fetch(`${REST()}/${col}?key=${firebaseConfig.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFs(v)])) })
  });
  if (!r.ok) throw new Error("Save failed (" + r.status + ")");
  return (await r.json()).name.split("/").pop();
}
async function restList(col, where) {
  if (where) {
    const r = await fetch(`${REST()}:runQuery?key=${firebaseConfig.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: col }],
        where: { fieldFilter: { field: { fieldPath: where[0] }, op: "EQUAL", value: toFs(where[1]) } },
        limit: 60 } })
    });
    if (!r.ok) throw new Error("Load failed (" + r.status + ")");
    return (await r.json()).filter((x) => x.document).map((x) => fromDoc(x.document));
  }
  const r = await fetch(`${REST()}/${col}?pageSize=60&key=${firebaseConfig.apiKey}`);
  if (!r.ok) throw new Error("Load failed (" + r.status + ")");
  return ((await r.json()).documents || []).map(fromDoc);
}

// Public lists are cached in the browser: repeat visits render instantly from the
// cache, then refresh quietly in the background (at most once a minute).
const CACHE_MS = 60e3;
async function cachedList(key, loader, onFresh) {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem("cfa_pub_" + key) || "null"); } catch (e) { /* ignore */ }
  const fetchFresh = async () => {
    const rows = await loader();
    try { localStorage.setItem("cfa_pub_" + key, JSON.stringify({ t: Date.now(), rows })); } catch (e) { /* quota */ }
    return rows;
  };
  if (cached && !isDemo) {
    if (Date.now() - cached.t > CACHE_MS && onFresh) {
      fetchFresh().then((rows) => { if (JSON.stringify(rows) !== JSON.stringify(cached.rows)) onFresh(rows); }).catch(() => {});
    }
    return cached.rows;
  }
  return fetchFresh();
}

export async function createBooking(b) {
  const data = { ...clean(b), status: "New", createdAt: Date.now(), source: "website" };
  if (isDemo) {
    const s = store();
    const id = uid();
    s.bookings[id] = { ...data, id };
    demoSave();
    return id;
  }
  return restCreate("bookings", data);
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

const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

// Active ad banners for the home page slider (max 6), in display order.
export async function listBanners(onFresh) {
  const pick = (rows) => rows.filter((b) => b.active !== false && b.image).sort(byOrder).slice(0, 6);
  if (isDemo) return pick(Object.values(store().banners || {}));
  return pick(await cachedList("banners", () => restList("banners"), onFresh && ((r) => onFresh(pick(r)))));
}

// "Meet our tutors" cards (max 10), managed in Admin → Website Tutors.
export async function listFeaturedTutors(onFresh) {
  const pick = (rows) => rows.filter((t) => t.active !== false && t.name).sort(byOrder).slice(0, 10);
  if (isDemo) return pick(Object.values(store().featuredTutors || {}));
  return pick(await cachedList("tutors", () => restList("featuredTutors"), onFresh && ((r) => onFresh(pick(r)))));
}

// Parent reviews: anyone can write one; it shows after the team approves it.
export async function listReviews() {
  const pick = (rows) => rows.filter((r) => r.approved === true).sort(sortDesc);
  if (isDemo) return pick(Object.values(store().reviews || {}));
  return pick(await restList("reviews", ["approved", true]));
}
export async function createReview(r) {
  const data = {
    name: String(r.name || "").trim().slice(0, 60),
    place: String(r.place || "").trim().slice(0, 60),
    rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0))),
    text: String(r.text || "").trim().slice(0, 600),
    approved: false,
    createdAt: Date.now()
  };
  if (isDemo) {
    const s = store();
    s.reviews = s.reviews || {};
    const id = uid();
    s.reviews[id] = { ...data, id };
    demoSave();
    return id;
  }
  return restCreate("reviews", data);
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
