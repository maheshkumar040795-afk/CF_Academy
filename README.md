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
| `index.html` | Home page (services, programmes, courses table, tutors, booking form) |
| `about.html` | About page (story, founders, why us, cities) |
| `contact.html` | Contact page (call, WhatsApp, office map, parent reviews) |
| `admin.html` | Admin panel (login required) |
| `js/site-config.js` | **Business details** — phones, WhatsApp, address, founders, subjects, cities |
| `js/firebase-config.js` | **Firebase keys + Apps Script URL** |
| `js/db.js` | Data layer (Firestore, or browser-only demo mode) |
| `js/common.js` | Shared website code: header, menu, scroll effects, contact details |
| `js/site.js` | Home page: booking form + WhatsApp draft, tutors, banners |
| `js/contact.js` | Contact page: map + reviews |
| `js/cloudinary.js` | Cloudinary uploads (admin) and fast resized image links (website) |
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
6. **Firestore → Rules** → paste `firestore.rules` (re-publish after every update — it now includes `tutorPayouts`), put the same 2 owner emails in `isOwner()` (lower case) → **Publish**.
7. Every other person gets a login from **Admin → Staff Config** (no Firebase console needed).
7. **Authentication → Settings → Authorized domains** → add your domain (e.g. `cfacademy.in`).

### 2. Google Sheet + email
Follow the steps at the top of `apps-script/Code.gs`, then paste the web app URL into `APPS_SCRIPT_URL` in `js/firebase-config.js`.

### 3. Business details
Edit `js/site-config.js`: office **address** (currently `[OFFICE ADDRESS]`), email, Instagram/Facebook. The Google Maps link and map pin (`mapUrl`, `mapLat`, `mapLng`) are already set to the office location.

### Programme cards (photos)
The 6 cards under “Our services” are listed in `PROGRAMS` at the bottom of `js/site-config.js`. To add a photo, paste its URL into that card's `image: ""` (any size — the full photo is shown, never cropped). Cards without a photo show a branded icon.

### “Find a tutor for anything” table
Tabs, groups and items are in `CATEGORIES` at the bottom of `js/site-config.js` (Online Classes, Tuition, Languages, IT Courses, Competitive Exams). The exams parents can tick in the booking form are in `EXAMS`. Clicking an item pre-fills the booking form. Please confirm the IT courses and exams listed there with the academy.

### Cloudinary (banner + tutor photo uploads)
Admin → **Website Banners** and **Website Tutors** upload photos to your free Cloudinary account (cloud name `u3hhrbtz`). Until the preset below is filled in, photos are compressed and saved in Firestore instead, so everything still works.

1. Sign in at https://console.cloudinary.com.
2. **Settings (gear icon) → Upload → Upload presets → Add upload preset.**
3. Fill in:
   - **Upload preset name**: `cfa_admin_unsigned` (any name).
   - **Signing mode**: **Unsigned** (needed because the admin panel uploads straight from the browser — never put the API *secret* in website code).
   - **Asset folder**: `cf-academy`.
   - **Use filename / Unique filename**: Unique filename on, Overwrite off.
4. Under **Upload Control / Restrictions** (to stop misuse of the preset):
   - **Allowed formats**: `jpg, jpeg, png, webp`.
   - **Max file size**: `5000000` (5 MB). Max image width/height: `4000`.
5. Under **Transformations → Incoming transformation**: `c_limit,w_2000,h_2000` (keeps originals a sensible size). Click **Save**.
6. Open `js/firebase-config.js` and set `uploadPreset: "cfa_admin_unsigned"` inside `CLOUDINARY` (cloudName is already `u3hhrbtz`).
7. Upload again from Admin → Website Banners / Website Tutors. The page now says “Photos are uploaded to Cloudinary”.

Notes
- The website asks Cloudinary for the right size and the best format automatically (`f_auto,q_auto,w_…`), so a 3 MB PNG becomes a ~40 KB WebP/AVIF on phones. The programme card photos in `site-config.js` use the same trick.
- Deleting a slide or tutor in the admin panel removes it from the website; the file stays in Cloudinary → Media Library (delete it there if you want).
- Free plan: 25 credits/month — far more than this site needs.

### 4. Import the 850 tutors
Admin → **Tutors → Excel template** → fill (or use the academy's own sheet — common headings like *Tutor Name, Phone No, Location* are recognised) → **Import Excel**. The preview shows new vs updated tutors and any bad rows before saving. Re-importing updates tutors with the same mobile number instead of duplicating.

### 5. Deploy
GitHub Pages: push this folder to a repo → Settings → Pages → `main` / root. Custom domain: add a `CNAME` file with the domain and point the DNS (CNAME `www` → `<user>.github.io`, plus the 4 GitHub A records), then enable HTTPS.

## How it stays fast and free
- The public pages do **not** load the Firebase SDK (~300 KB). They talk to Firestore through its small REST API — same security rules.
- Banners and tutor cards are cached in the browser and refreshed in the background, so repeat visits show them instantly.
- Photos come from Cloudinary already resized for the screen; images below the screen load only when scrolled to.
- Animations use only `transform`/`opacity` (GPU friendly) and switch off for visitors who prefer reduced motion.
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
- **Website Tutors** (Owner/Admin) — the 10 “Meet our tutors” cards on the home page: photo (cropped square), name, experience and subject; reorder, hide, edit, delete. The section hides itself when there are no cards.
- **Parent Reviews** — parents write reviews on the Contact page (star rating, name, area, text). Each review waits here until someone taps **Approve & show**; “Remove from website” hides it again; Owner/Admin can delete.
- **Staff Config** — create staff logins (email + password, or Generate), choose Staff/Admin, share credentials (copy / WhatsApp), edit, deactivate/activate, send password-reset email. Everyone can use "Change my password".
- **Website Banners** (Owner/Admin) — up to 6 slides at 1756 × 450 px, auto-cropped and compressed in the browser, saved in Firestore (no paid Storage plan needed); reorder, hide/show, link to the booking form or any URL. They play as an auto slider above “Our services” on the website and the section hides itself when there are no slides.
- **Student Allocation** — students waiting for a tutor; best-matched tutors by subject, class, area/city or online, with each tutor's current number of students; allocate or change tutor; WhatsApp the tutor (student + parent details) and the parent (tutor details); allocation history; "By tutor" view; Excel export.
- **Dashboard** — today's bookings, waiting/overdue calls (red after 2 hours), fees collected and pending.
- **Bookings / Leads** — live list with status tabs; call / WhatsApp parent; "being handled by" so two admins don't call the same parent; best-matched tutor suggestions (subject + area/city, or online); assign tutor; WhatsApp the tutor with the requirement; follow-up date and call notes; convert to student; add phone/walk-in leads; export to Excel.
- **Tutors** — 850+ tutors with search and filters, add / edit / delete (warns if the tutor has active students), Excel import/export.
- **Tutor salary (₹ icon on each tutor, and "Salary sheet")** — weekly or monthly salary = classes of the tutor's allocated students × hours per class × the tutor's salary per hour ("Fee per hour" column). Class days come from the student's schedule (e.g. "Mon, Wed, Fri · 6 – 8 PM") and can be corrected in the salary screen. Enter leave days to deduct (hours lost per leave day is pre-filled, deduction is editable), add any +/− adjustment, then **Save as pending** or **Mark as paid** (UPI / bank / cash + reference). With the tutor's UPI ID saved, "Open UPI app" starts the transfer on a phone; "Send salary slip" WhatsApps the tutor. Weekly payouts inside a month are subtracted from that month's salary so nothing is paid twice. Saved in the `tutorPayouts` collection.
- **Students** — tutor, schedule, monthly fee, payment history. A **₹ fee icon** on every row: green = paid this month, amber = due within 3 days, red = due today / overdue; it opens the month-wise fee card with due dates, last month's balance, WhatsApp reminder and Record payment. The fee is due on the joining day each month unless a **Fee due day** is set on the student. Students added here (not from a booking) are counted as **direct admissions**.
- **Fees** — month view of paid / partial / due, WhatsApp reminder, export.
- **Receipts** — numbered receipts `CFA/2026-27/0001` (financial year), print / save as PDF, send summary on WhatsApp, Delete button on every receipt (Owner/Admin).
- **Reports** — bookings / leads (website vs phone), bookings converted, **direct admissions** (students added straight in admin), total new students, collections and bookings by month, new students by month, by subject/exam, status and area, tutor-wise students; Excel download.
