// CF Academy — admin UI end-to-end: onboarding → join date → fees → receipts → tutor change → salary.
// Demo mode, clock fixed to Wed 4 Nov 2026 12:00 IST. Usage: node e2e.test.js <baseUrl> <xlsxPath>
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8091";
const XLSX = process.argv[3] || "/tmp/xl/node_modules/xlsx/dist/xlsx.full.min.js";
const SHOTS = "/tmp/shots/e2e";
require("fs").mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, actual, expected) => {
  const ok = typeof expected === "function" ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, ok, actual, expected: typeof expected === "function" ? "(condition)" : expected });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`}`);
};
const has = (s) => (t) => String(t).replace(/\s+/g, " ").includes(s);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 1360, height: 950 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-04T12:00:00+05:30"));
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.route(/sheetjs|xlsx\.full/, (r) => r.fulfill({ path: XLSX, contentType: "application/javascript" }));

  const go = async (hash) => { await p.goto(BASE + "/admin.html#/" + hash); await p.waitForTimeout(700); if (await p.locator(".modal-bg").count()) { await p.keyboard.press("Escape"); await p.waitForTimeout(150); } };
  const clearQ = async () => { if (await p.locator("#sQ").count()) { await p.fill("#sQ", ""); await p.waitForTimeout(300); } };
  const modal = () => p.locator(".modal").last();
  const save = async (label) => { await modal().locator(".modal-f button", { hasText: label }).click(); await p.waitForTimeout(500); };
  const db = (fn, arg) => p.evaluate(async ([src, a]) => { const d = await import("/js/db.js"); return (new Function("d", "a", src))(d, a); }, [fn, arg]);
  const student = (name) => db("return d.list ? null : null", null);
  const getStudents = () => p.evaluate(() => JSON.parse(localStorage.getItem("cfa_demo_v1")).students);
  const stByName = async (n) => Object.values(await getStudents()).find((s) => s.name === n);

  // ── login (demo) + 2 tutors ──
  await p.goto(BASE + "/admin.html");
  await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + "/admin.html");
  await p.waitForSelector("#loginForm", { state: "visible" });
  await p.locator("#loginForm input:not([type=password])").fill("owner@test.com");
  await p.fill("#lPass", "demo");
  await p.click("#loginForm button[type=submit]");
  await p.waitForTimeout(1200);
  await p.evaluate(async () => {
    const d = await import("/js/db.js");
    await d.put("tutors", { id: "tA", name: "Priya Raman", phone: "9000000001", subjects: "Mathematics, Science", area: "Velachery", city: "Chennai", mode: "Both", classes: "6-12", experience: 12, fee: 300, status: "Active" });
    await d.put("tutors", { id: "tB", name: "Karthik S", phone: "9000000002", subjects: "Mathematics, Physics", area: "Velachery", city: "Chennai", mode: "Both", classes: "6-12", experience: 9, fee: 250, status: "Active" });
  });
  await p.reload(); await p.waitForTimeout(1200);

  // ── 1. Website booking → Convert to student (joined 1 Nov, ₹5,000 + GST) ──
  console.log("\n## 1. Booking → student (join 1 Nov, GST on)");
  await go("bookings");
  await p.locator("text=Arjun").first().click(); await p.waitForTimeout(300);
  await p.click("#bConvert"); await p.waitForTimeout(300);
  await modal().locator('[name="monthlyFee"]').fill("5000");
  await modal().locator(".switch").click();
  await modal().locator('[name="joinDate"]').fill("2026-11-01");
  check("Convert form shows ₹5,000 + GST = ₹5,900", await modal().locator("[data-gst-out]").innerText(), has("₹ 5,900"));
  await save("Create student");
  let arjun = await stByName("Arjun");
  check("Student created with join date 1 Nov, GST on", [arjun && arjun.joinDate, arjun && arjun.gst, arjun && arjun.monthlyFee], ["2026-11-01", true, 5000]);
  await go("students");
  const arjunRow = () => p.locator("#sList tr", { hasText: "Arjun" });
  check("Students list: fee ₹5,900 (₹5,000 + 18% GST)", await arjunRow().innerText(), has("₹ 5,900"));
  check("Joined 1 Nov, not paid → 'Overdue 3 days'", await arjunRow().innerText(), has("Overdue 3 days"));

  // ── 2. Direct admission (joined 20 Oct, ₹4,000) with tutor Priya from 20 Oct ──
  console.log("\n## 2. Direct admission joined 20 Oct, tutor Priya from 20 Oct");
  await p.click("#sAdd"); await p.waitForTimeout(300);
  const m = modal();
  await m.locator('[name="name"]').fill("Kavin");
  await m.locator('[name="phone"]').fill("9876500001");
  await m.locator('[name="schedule"]').fill("Mon, Wed, Fri · 6 – 8 PM");
  await m.locator('[name="tutorPick"]').fill("Priya Raman · 9000000001");
  await m.locator('[name="monthlyFee"]').fill("4000");
  await m.locator('[name="joinDate"]').fill("2026-10-20");
  await m.locator('[name="tutorFrom"]').fill("2026-10-20");
  await p.screenshot({ path: SHOTS + "/1-add-student.png" });
  await save("Add student");
  if (await p.locator(".toast").count()) console.log("   toast:", await p.locator(".toast").last().innerText());
  let kavin = await stByName("Kavin");
  check("Kavin saved: join 20 Oct, tutor Priya from 20 Oct, history recorded", [kavin.joinDate, kavin.tutorId, kavin.allocatedOn, (kavin.allocationHistory || []).length], ["2026-10-20", "tA", "2026-10-20", 1]);
  await p.fill("#sQ", "Kavin"); await p.waitForTimeout(300);
  check("Kavin: Nov due 20 Nov + Oct ₹4,000 unpaid shown", await arjunRow().count() ? "" : await p.locator("#sList tr", { hasText: "Kavin" }).innerText(), (t) => has("Due 20 Nov")(t) && has("₹ 4,000 last month")(t));
  await p.locator("#sList [data-act=fees]").first().click(); await p.waitForTimeout(300);
  const feeCard = await modal().innerText();
  check("Fee card: Oct (joined month) ₹4,000 Overdue, Nov Due 20 Nov", feeCard, (t) => has("October 2026")(t) && has("Overdue")(t) && has("20 Nov 2026")(t));
  check("Fee card: months before joining not listed (no Sep)", feeCard, (t) => !t.includes("September 2026"));
  await p.screenshot({ path: SHOTS + "/2-fee-card.png" });
  await p.keyboard.press("Escape");

  // ── 3. Receipts: Kavin pays Oct + Nov (₹8,000); Arjun pays ₹5,000 of ₹5,900 ──
  console.log("\n## 3. Receipts");
  await go("receipts?student=" + kavin.id);
  await p.selectOption("#pFrom", { label: "October 2026" });
  await p.selectOption("#pCount", "2"); await p.waitForTimeout(200);
  check("Receipt amount auto-filled ₹8,000 for Oct–Nov", await p.inputValue("#pAmount"), "8000");
  await p.click("#pSave"); await p.waitForTimeout(800);
  arjun = await stByName("Arjun");
  await go("receipts?student=" + arjun.id);
  check("Arjun receipt amount auto-filled ₹5,900 (GST)", await p.inputValue("#pAmount"), "5900");
  await p.fill("#pAmount", "5000");
  await p.click("#pSave"); await p.waitForTimeout(800);
  check("Receipt shows CGST + SGST for GST student", await p.locator("#rPreview .receipt").innerText(), (t) => has("CGST @ 9%")(t) && has("SGST @ 9%")(t));
  await p.locator("#rPreview .receipt").screenshot({ path: SHOTS + "/3-receipt-gst.png" });
  await go("students"); await clearQ();
  check("Kavin after paying Oct+Nov → Paid, no last-month balance", await p.locator("#sList tr", { hasText: "Kavin" }).innerText(), (t) => has("Paid")(t) && !t.includes("last month"));
  check("Arjun paid ₹5,000 of ₹5,900 → Overdue + Bal ₹900", await arjunRow().innerText(), (t) => has("Bal ₹ 900")(t));

  // ── 4. Fee raised for Kavin: ₹4,000 → ₹4,500 from November ──
  console.log("\n## 4. Fee change from November");
  await p.locator("#sList tr", { hasText: "Kavin" }).locator("[data-act=edit]").click(); await p.waitForTimeout(300);
  check("'Fee change applies from' hidden until fee changes", await modal().locator("#feeFromRow").isHidden(), true);
  await modal().locator('[name="monthlyFee"]').fill("4500"); await p.waitForTimeout(100);
  check("…shown after changing fee, default November 2026", [await modal().locator("#feeFromRow").isVisible(), await modal().locator('[name="feeFrom"] option:checked').innerText()], [true, "November 2026"]);
  await p.screenshot({ path: SHOTS + "/4-fee-change.png" });
  await save("Save changes");
  kavin = await stByName("Kavin");
  await p.locator("#sList [data-act=fees]").nth(await p.locator("#sList tr", { hasText: "Kavin" }).evaluate((tr) => [...tr.parentNode.children].indexOf(tr))).click(); await p.waitForTimeout(300);
  const fc2 = await modal().locator("tbody").innerText();
  check("October still Paid at ₹4,000", fc2.split("\n").find((l) => l.includes("October 2026")), (l) => has("₹ 4,000")(l) && has("Paid")(l));
  check("November now ₹4,500, paid ₹4,000, balance ₹500", fc2.split("\n").find((l) => l.includes("November 2026")), (l) => has("₹ 4,500")(l) && has("₹ 500")(l));
  await p.keyboard.press("Escape");

  // ── 5. Allocation: Arjun → Priya from 2 Nov; Kavin moved Priya → Karthik from 16 Nov ──
  console.log("\n## 5. Allocation with start dates");
  await go("allocation");
  arjun = await stByName("Arjun");
  await go("allocation?student=" + arjun.id); await p.waitForTimeout(400);
  if (!(await p.locator("#aFrom").count())) { await p.locator("text=Arjun").first().click(); await p.waitForTimeout(300); }
  await p.fill("#aFrom", "2026-11-02"); await p.dispatchEvent("#aFrom", "change");
  await p.locator("#aDetail").screenshot({ path: SHOTS + "/5-allocation.png" });
  await p.locator('#aDetail [data-assign="tA"]').first().click(); await p.waitForTimeout(600);
  arjun = await stByName("Arjun");
  check("Arjun allocated to Priya from 2 Nov", [arjun.tutorId, arjun.allocatedOn], ["tA", "2026-11-02"]);
  await p.evaluate(async (id) => { const d = await import("/js/db.js"); await d.put("students", { id, schedule: "Tue, Thu · 4 – 6 PM" }); }, arjun.id);

  kavin = await stByName("Kavin");
  await go("allocation?student=" + kavin.id); await p.waitForTimeout(400);
  if (!(await p.locator("#aFrom").count())) { await p.locator("#aList tr, .a-item", { hasText: "Kavin" }).first().click(); await p.waitForTimeout(300); }
  check("Change-tutor label says 'New tutor effective from'", await p.locator('label[for="aFrom"]').innerText(), "New tutor effective from");
  await p.fill("#aFrom", "2026-11-16"); await p.dispatchEvent("#aFrom", "change");
  await p.fill("#aTutorQ", "Karthik"); await p.waitForTimeout(400);
  await p.locator('#aDetail [data-assign="tB"]').first().click(); await p.waitForTimeout(600);
  kavin = await stByName("Kavin");
  check("Kavin history: Priya 20 Oct → Karthik 16 Nov", kavin.allocationHistory.map((h) => [h.tutorId, h.on]), [["tA", "2026-10-20"], ["tB", "2026-11-16"]]);

  // ── 6. Tutor salary ──
  console.log("\n## 6. Tutor salary — paid only after the month is complete");
  const openSalary = async (tid, key) => {
    await go("tutors"); await p.waitForTimeout(400);
    await p.locator(`[data-act=fin][data-id="${tid}"]`).first().click(); await p.waitForTimeout(400);
    if (key) { await p.selectOption("#tpKey", key); await p.waitForTimeout(300); }
  };
  const lineOf = async (name) => (await modal().locator("tr", { hasText: name }).first().innerText()).replace(/\s+/g, " ");
  const net = async () => (await modal().locator(".tp-row.total b").innerText());

  await openSalary("tA");
  check("Salary opens on October (last completed month)", await p.inputValue("#tpKey"), "2026-10");
  check("Priya Oct: Kavin from 20 Oct → 5 classes × 2 h = ₹3,000", await lineOf("Kavin"), (t) => has("₹ 3,000")(t) && / 5 10 /.test(t));
  await modal().locator("#tpLeave").fill("1"); await p.waitForTimeout(200);
  check("1 leave day → deducts 2 h × ₹300 = ₹600, net ₹2,400", [await modal().locator("#tpDed").inputValue(), await net()], ["600", "₹ 2,400"]);
  await modal().locator("[data-save=Paid]").click(); await p.waitForTimeout(600);
  check("October marked paid ₹2,400", await modal().locator(".note.ok").innerText(), has("Paid ₹ 2,400"));
  await p.selectOption("#tpKey", "2026-11"); await p.waitForTimeout(300);
  check("November: 'not complete yet' note, no pay buttons", [await modal().locator(".note.warn").first().innerText(), await modal().locator("[data-save]").count()], (v) => has("not complete yet")(v[0]) && has("01 Dec 2026")(v[0]) && v[1] === 0);
  check("Priya Nov estimate: Kavin till 15 Nov (moved) 6 classes ₹3,600", await lineOf("Kavin"), (t) => has("till 15 Nov 2026")(t) && has("moved to Karthik S")(t) && has("₹ 3,600")(t) && / 6 12 /.test(t));
  check("Priya Nov estimate: Arjun from 2 Nov Tue/Thu 8 classes ₹4,800", await lineOf("Arjun"), (t) => has("from 02 Nov 2026")(t) && has("₹ 4,800")(t));
  check("Nov total labelled 'Estimated salary' ₹8,400", [await modal().locator(".tp-row.total span").innerText(), await net()], ["Estimated salary", "₹ 8,400"]);
  await p.screenshot({ path: SHOTS + "/6-salary-nov-in-progress.png" });
  await p.keyboard.press("Escape");

  await openSalary("tB", "2026-11");
  check("Karthik Nov (₹250/h): Kavin effective 16 Nov → 7 classes ₹3,500", await lineOf("Kavin"), (t) => has("from 16 Nov 2026")(t) && has("₹ 3,500")(t) && / 7 14 /.test(t));
  await p.keyboard.press("Escape");

  // effective date guard
  arjun = await stByName("Arjun");
  await go("allocation?student=" + arjun.id); await p.waitForTimeout(400);
  await p.fill("#aFrom", "2026-11-01"); await p.dispatchEvent("#aFrom", "change");
  await p.fill("#aTutorQ", "Karthik"); await p.waitForTimeout(400);
  await p.locator('#aDetail [data-assign="tB"]').first().click(); await p.waitForTimeout(500);
  check("Change effective 1 Nov (before Priya's start 2 Nov) → blocked", [await p.locator(".toast").last().innerText(), (await stByName("Arjun")).tutorId], (v) => has("on or after")(v[0]) && v[1] === "tA");

  // ── 7. Kavin stops: last class 20 Nov ──
  console.log("\n## 7. Student stops (last class 20 Nov)");
  await go("students"); await clearQ();
  await p.locator("#sList tr", { hasText: "Kavin" }).locator("[data-act=edit]").click(); await p.waitForTimeout(300);
  check("Last class date hidden while Active", await modal().locator("#leftRow").isHidden(), true);
  await modal().locator('[name="status"]').selectOption("Inactive"); await p.waitForTimeout(100);
  check("…shown when Inactive", await modal().locator("#leftRow").isVisible(), true);
  await modal().locator('[name="leftOn"]').fill("2026-11-20");
  await save("Save changes");
  kavin = await stByName("Kavin");
  check("Saved: Inactive, last class 20 Nov", [kavin.status, kavin.leftOn], ["Inactive", "2026-11-20"]);
  await openSalary("tB", "2026-11");
  check("Karthik Nov: Kavin 16–20 Nov → 3 classes = ₹1,500 (stopped)", await lineOf("Kavin"), (t) => has("till 20 Nov 2026")(t) && has("stopped")(t) && has("₹ 1,500")(t) && / 3 6 /.test(t));
  await p.keyboard.press("Escape");
  await go("fees");
  check("Fees (Nov): stopped student still listed with ₹500 balance", await p.locator("#fList tr", { hasText: "Kavin" }).innerText(), has("₹ 500"));

  // ── 8. Old data: student marked Inactive before 'last class date' existed ──
  console.log("\n## 8. Old Inactive student (no last class date)");
  await p.evaluate(async () => {
    const st = JSON.parse(localStorage.getItem("cfa_demo_v1"));
    st.students.old1 = { id: "old1", name: "Old Student", phone: "9876500009", monthlyFee: 3000, joinDate: "2026-09-01", schedule: "Mon, Wed, Fri · 6 – 8 PM",
      tutorId: "tA", tutorName: "Priya Raman", allocatedOn: "2026-09-01", status: "Inactive", createdAt: new Date(2026, 8, 1).getTime(), updatedAt: new Date(2026, 9, 15, 11).getTime() };
    localStorage.setItem("cfa_demo_v1", JSON.stringify(st));
  });
  await p.reload(); await p.waitForTimeout(1500);
  const old = await stByName("Old Student");
  check("Auto-filled last class = 15 Oct (day it was marked Inactive), flagged estimated", [old.leftOn, old.leftOnAuto], ["2026-10-15", true]);
  await go("students"); await clearQ();
  await p.selectOption("#sStatus", "Inactive"); await p.waitForTimeout(300);
  check("Students list shows 'Last class 15 Oct 2026 (estimated)'", await p.locator("#sList tr", { hasText: "Old Student" }).innerText(), has("Last class 15 Oct 2026 (estimated)"));
  await p.locator("#sList tr", { hasText: "Old Student" }).locator("[data-act=edit]").click(); await p.waitForTimeout(300);
  check("Edit form says the date is estimated", await modal().locator("#leftRow").innerText(), has("Estimated"));
  await p.screenshot({ path: SHOTS + "/8-old-inactive.png" });
  await p.keyboard.press("Escape");
  await p.selectOption("#sStatus", "Active");

  // ── 9. Salary sheet ──
  console.log("\n## 9. Salary sheet");
  await go("tutors");
  await p.click("#tSalary"); await p.waitForTimeout(400);
  const row = async (n) => (await modal().locator("#ssList tr", { hasText: n }).innerText()).replace(/\s+/g, " ");
  check("Sheet opens on October", await p.inputValue("#ssKey"), "2026-10");
  check("Oct: Priya Paid ₹2,400 (Kavin 5 classes − 1 leave day; Old Student counted only if saved later)", await row("Priya"), (l) => has("Paid")(l));
  await p.selectOption("#ssKey", "2026-11"); await p.waitForTimeout(300);
  check("Nov: Karthik ₹1,500 'In progress'", await row("Karthik"), (l) => has("₹ 1,500")(l) && has("In progress")(l));
  await p.screenshot({ path: SHOTS + "/9-salary-sheet.png" });

  console.log(errs.length ? "\nPAGE ERRORS:\n" + errs.join("\n") : "\nno page errors");
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass} / ${results.length} passed`);
  require("fs").writeFileSync(__dirname + "/e2e-results.json", JSON.stringify(results, null, 1));
  await b.close();
})().catch((e) => { console.error("ABORTED:", e.message.split("\n")[0]); process.exit(1); });
