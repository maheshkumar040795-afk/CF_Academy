# CF Academy — automated tests (fees, join date, tutor salary)

Both tests run the real admin code in Chromium (demo mode) with the clock fixed to **Wed 4 Nov 2026, 12:00 IST**, so the expected numbers never change.

```
# 1. serve a demo copy (FORCE_DEMO = true)
cp -r . /tmp/cft && sed -i 's/FORCE_DEMO = false/FORCE_DEMO = true/' /tmp/cft/js/firebase-config.js
(cd /tmp/cft && python3 -m http.server 8091 &)
# 2. run (needs: npm i playwright xlsx)
node tests/logic.test.js http://localhost:8091      # 82 checks — fee due dates, payments, GST, fee changes, salary
node tests/e2e.test.js   http://localhost:8091 node_modules/xlsx/dist/xlsx.full.min.js   # 41 checks — full admin flow
```

`logic.test.js` — fee due date from join date (today / overdue / 3-day window / next month / 31st / custom due day), part & multi-month payments, GST, fee raised later, tutor salary by join date, allocation date, schedules (Mon–Sat, daily, weekdays, 12–2 PM…), tutor changed mid-month, student stopped mid-month, weekly periods.

`e2e.test.js` — booking → convert (GST) → direct admission → fee card → receipts (multi-month, part, GST split) → fee change from a month → allocation with start dates → tutor change → salary with leave → student stops → Fees page → salary sheet.
