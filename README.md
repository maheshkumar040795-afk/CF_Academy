# CF Academy — website + admin panel

Parents book a home or online tutor on the website. Each booking:
1. opens **WhatsApp** with all details drafted to 81908 70673,
2. is saved to **Firebase (Firestore)** and appears live on the admin **Bookings** page,
3. is added as a row to the **Google Sheet** (and emailed to the admins) via Apps Script.

Admins (2 logins) allocate one of the 850+ tutors by subject and location, convert the lead to a student, track fees and print receipts.

Stack: plain HTML/CSS/JavaScript (no build step) · Firebase Firestore + Auth · SheetJS for Excel · Google Apps Script.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Public website (home, services, booking form, about, contact) |
| `admin.html` | Admin panel (login required) |
| `js/site-config.js` | **Business details** — phones, WhatsApp, address, founders, subjects, cities |
| `js/firebase-config.js` | **Firebase keys + Apps Script URL** |
| `js/db.js` | Data layer (Firestore, or browser-only demo mode) |
| `js/site.js` | Website booking form + WhatsApp draft |
| `js/admin/*.js` | Admin screens: dashboard, bookings, tutors, students, fees, receipts, reports |
| `css/` | Styles (white · logo blue #0A2A66 · logo green #0B7A62) |
| `assets/logo.png`, `logo-192.png`, `favicon.png` | Challenge Future Academy logo |
| `firestore.rules` | Security rules (paste into Firebase) |
| `apps-script/Code.gs` | Google Sheet + email script |
| `templates/CF-Academy-Tutor-Template.xlsx` | Excel template for importing tutors |
| `templates/Sample-850-Tutors-for-testing.xlsx` | 850 fake tutors to test the import (do not upload to the live site) |

## Try it now (demo mode)

With `FORCE_DEMO = true` in `firebase-config.js` the site runs in **demo mode** — everything works, but data is stored only in your browser.

```
cd cf-academy
python3 -m http.server 8080      # or: npx serve
```
Open http://localhost:8080 (website) and http://localhost:8080/admin.html (admin — any email, password `demo`).
ES modules need a web server; opening the file directly from disk will not work.

## Go live — setup checklist

### 1. Firebase (free Spark plan is enough)
1. https://console.firebase.google.com → **Add project** → name `cf-academy`.
2. **Build → Firestore Database → Create database** → region `asia-south1 (Mumbai)` → production mode.
3. **Build → Authentication → Get started → Email/Password → Enable.**
4. **Authentication → Users → Add user** — create the **2 OWNER logins** (email + strong password). Put the same 2 emails in `OWNER_EMAILS` in `js/firebase-config.js`.
5. `firebaseConfig` is already filled in `js/firebase-config.js` (project `cf-academy-729b6`).
6. **Firestore → Rules** → paste `firestore.rules`, put the same 2 owner emails in `isOwner()` (lower case) → **Publish**.
7. Every other person gets a login from **Admin → Staff Config** (no Firebase console needed).
7. **Authentication → Settings → Authorized domains** → add your domain (e.g. `cfacademy.in`).

### 2. Google Sheet + email
Follow the steps at the top of `apps-script/Code.gs`, then paste the web app URL into `APPS_SCRIPT_URL` in `js/firebase-config.js`.

### 3. Business details
Edit `js/site-config.js`: office **address** (currently `[OFFICE ADDRESS]`), Google Maps link, email, Instagram/Facebook.

### Programme cards (photos)
The 6 cards under “Our services” are listed in `PROGRAMS` at the bottom of `js/site-config.js`. To add a photo, paste its URL into that card's `image: ""` (any size — the full photo is shown, never cropped). Cards without a photo show a branded icon.

### 4. Import the 850 tutors
Admin → **Tutors → Excel template** → fill (or use the academy's own sheet — common headings like *Tutor Name, Phone No, Location* are recognised) → **Import Excel**. The preview shows new vs updated tutors and any bad rows before saving. Re-importing updates tutors with the same mobile number instead of duplicating.

### 5. Deploy
GitHub Pages: push this folder to a repo → Settings → Pages → `main` / root. Custom domain: add a `CNAME` file with the domain and point the DNS (CNAME `www` → `<user>.github.io`, plus the 4 GitHub A records), then enable HTTPS.

## How it stays fast and free
- Parents never load the tutor list — the public site only **creates** a booking (1 write).
- Admins load the 850 tutors once per session (~850 reads); with 2 admins that is well inside the free 50,000 reads/day.
- Bookings, students and payments use live listeners, so both admins see changes instantly without refreshing.
- Tutor/student tables render 50 rows at a time; search is in-memory and instant.

## Security notes
- Parents can create bookings but cannot read any data. Tutors, students, payments and receipts are admin-only (Firestore rules).
- All text from the public form is escaped before it is shown in the admin panel.
- Optional hardening: enable **Firebase App Check** (reCAPTCHA v3) to block bots from spamming the booking form.

## Logins and roles
| Role | Who | Can do |
| --- | --- | --- |
| Owner | 2 emails in `OWNER_EMAILS` + `firestore.rules` | Everything |
| Admin | Created in Staff Config with role Admin | Everything, incl. Reports, deletes, Staff Config |
| Staff | Created in Staff Config with role Staff | Bookings, tutors, students, allocation, fees, receipts — no deletes, no Reports, no Staff Config |

Deactivating a staff login in Staff Config blocks it immediately (Firestore rules check the `staff` record). To remove the login completely, delete the user in Firebase console → Authentication.

## Admin features
- **Staff Config** — create staff logins (email + password, or Generate), choose Staff/Admin, share credentials (copy / WhatsApp), edit, deactivate/activate, send password-reset email. Everyone can use "Change my password".
- **Website Banners** (Owner/Admin) — up to 6 slides at 1756 × 450 px, auto-cropped and compressed in the browser, saved in Firestore (no paid Storage plan needed); reorder, hide/show, link to the booking form or any URL. They play as an auto slider above “Our services” on the website and the section hides itself when there are no slides.
- **Student Allocation** — students waiting for a tutor; best-matched tutors by subject, class, area/city or online, with each tutor's current number of students; allocate or change tutor; WhatsApp the tutor (student + parent details) and the parent (tutor details); allocation history; "By tutor" view; Excel export.
- **Dashboard** — today's bookings, waiting/overdue calls (red after 2 hours), fees collected and pending.
- **Bookings / Leads** — live list with status tabs; call / WhatsApp parent; "being handled by" so two admins don't call the same parent; best-matched tutor suggestions (subject + area/city, or online); assign tutor; WhatsApp the tutor with the requirement; follow-up date and call notes; convert to student; add phone/walk-in leads; export to Excel.
- **Tutors** — 850+ tutors with search and filters, add / edit / delete (warns if the tutor has active students), Excel import/export.
- **Students** — tutor, schedule, monthly fee, this month's fee status, payment history.
- **Fees** — month view of paid / partial / due, WhatsApp reminder, export.
- **Receipts** — numbered receipts `CFA/2026-27/0001` (financial year), print / save as PDF, send summary on WhatsApp.
- **Reports** — collections and bookings by month, by subject, status and area, tutor-wise students; Excel download.
