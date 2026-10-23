// ─────────────────────────────────────────────────────────────
//  CF Academy — Firebase + Google Sheet settings
//  (Firebase web config is public by design — the Firestore rules
//   in firestore.rules are what protect the data.)
// ─────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: "AIzaSyCsr_jrmCNoRF7IlFKMqvzEqLSuHetElBI",
  authDomain: "cf-academy-729b6.firebaseapp.com",
  projectId: "cf-academy-729b6",
  storageBucket: "cf-academy-729b6.firebasestorage.app",
  messagingSenderId: "174619506601",
  appId: "1:174619506601:web:2cfccb0d324727d34a76b8"
};

// OWNER logins (full access, can create staff). Create these 2 users in
// Firebase console → Authentication → Users → Add user, then put the SAME
// emails here AND in firestore.rules (isOwner).
export const OWNER_EMAILS = [
  "cfacademyadmin@gmail.com",
  "owner2@example.com"    // TODO: e.g. V. Akshaya's login email
];

// Google Apps Script web app URL that appends each booking to the
// Google Sheet and emails the academy. Leave empty to skip.
export const APPS_SCRIPT_URL = "";

// Cloudinary — photo uploads from the admin panel (website banners + tutor photos).
// cloudName: Cloudinary dashboard → top-left "Cloud name".
// uploadPreset: Settings → Upload → Upload presets → your UNSIGNED preset name.
// Leave uploadPreset empty and photos are stored (compressed) inside Firestore instead.
export const CLOUDINARY = {
  cloudName: "u3hhrbtz",
  uploadPreset: "",          // TODO: e.g. "cfa_admin_unsigned"
  folder: "cf-academy"
};

// Set to true to try the site without Firebase (data stays in this browser,
// admin password "demo").
export const FORCE_DEMO = false;
