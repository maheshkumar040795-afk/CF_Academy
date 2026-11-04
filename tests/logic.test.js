// CF Academy — fee & tutor-salary logic tests. Runs the real modules in Chromium
// with the clock fixed to Wed 4 Nov 2026, 12:00 IST.
// Usage: node logic.test.js <baseUrl>
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8091";

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ timezoneId: "Asia/Kolkata" });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date("2026-11-04T12:00:00+05:30"));
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.goto(BASE + "/404.html");

  const results = await p.evaluate(async () => {
    const C = await import("/js/admin/common.js");
    const T = await import("/js/admin/tutorpay.js");
    const out = [];
    const eq = (group, name, actual, expected) => out.push({ group, name, actual: JSON.stringify(actual), expected: JSON.stringify(expected), ok: JSON.stringify(actual) === JSON.stringify(expected) });
    const S = (o) => ({ id: o.id || "s" + Math.random().toString(36).slice(2, 7), name: "Kid", status: "Active", monthlyFee: 5000, ...o });
    const pay = (s, amount, keys) => ({ studentId: s.id, amount, monthKeys: keys });
    const due = (s, pays = []) => { const d = C.feeDue(s, pays); return { kind: d.kind, label: d.label, balance: d.balance, prevDue: d.prevDue, due: d.due.toLocaleDateString("en-CA") }; };

    // ───────── FEES: due date from join date ─────────
    let s;
    s = S({ joinDate: "2026-11-04" });
    eq("Fee · join date", "F1 Joined today (4 Nov) → fee due today", due(s), { kind: "today", label: "Due today", balance: 5000, prevDue: 0, due: "2026-11-04" });
    s = S({ joinDate: "2026-11-03" });
    eq("Fee · join date", "F2 Joined yesterday, not paid → overdue 1 day", due(s), { kind: "late", label: "Overdue 1 day", balance: 5000, prevDue: 0, due: "2026-11-03" });
    s = S({ joinDate: "2026-11-06" });
    eq("Fee · join date", "F3 Joins 6 Nov → due in 2 days (reminder window)", due(s), { kind: "soon", label: "Due in 2 days", balance: 5000, prevDue: 0, due: "2026-11-06" });
    s = S({ joinDate: "2026-11-07" });
    eq("Fee · join date", "F4 Joins 7 Nov → due in 3 days (edge of window)", due(s).kind, "soon");
    s = S({ joinDate: "2026-11-08" });
    eq("Fee · join date", "F5 Joins 8 Nov → 4 days away, not yet in window", due(s), { kind: "upcoming", label: "Due 8 Nov", balance: 5000, prevDue: 0, due: "2026-11-08" });
    s = S({ joinDate: "2026-12-10" });
    eq("Fee · join date", "F6 Joins next month (10 Dec) → 'Starts 10 Dec', nothing due", due(s).label, "Starts 10 Dec");
    s = S({ joinDate: "2026-10-20" });
    eq("Fee · join date", "F7 Joined 20 Oct, Oct not paid → Nov upcoming + Oct balance carried", due(s), { kind: "upcoming", label: "Due 20 Nov", balance: 5000, prevDue: 5000, due: "2026-11-20" });
    eq("Fee · join date", "F8 Joined 20 Oct, Oct paid → no carry-over", due(s, [pay(s, 5000, ["2026-10"])]).prevDue, 0);
    s = S({ joinDate: "2026-01-31" });
    eq("Fee · join date", "F9 Joined on 31st → due 30 Nov (short month)", due(s).due, "2026-11-30");
    eq("Fee · join date", "F9b …and 28 Feb in February", C.dueDateFor(s, "2026-02").toLocaleDateString("en-CA"), "2026-02-28");
    s = S({ joinDate: "2026-10-20", feeDueDay: 5 });
    eq("Fee · join date", "F10 Due day 5 but joined 20 Oct → first due date is join date", C.dueDateFor(s, "2026-10").toLocaleDateString("en-CA"), "2026-10-20");
    eq("Fee · join date", "F10b …then 5th every month (Nov 5 → due in 1 day)", due(s, [pay(s, 5000, ["2026-10"])]), { kind: "soon", label: "Due in 1 day", balance: 5000, prevDue: 0, due: "2026-11-05" });
    s = S({ joinDate: "" });
    eq("Fee · join date", "F11 No join date → due on the 5th", due(s).due, "2026-11-05");
    s = S({ joinDate: "2026-09-01", monthlyFee: 0 });
    eq("Fee · join date", "F12 No fee set → 'No fee set'", due(s).kind, "none");

    // ───────── FEES: payments ─────────
    s = S({ joinDate: "2026-09-01" });
    const sep = [pay(s, 5000, ["2026-09"]), pay(s, 5000, ["2026-10"])];
    eq("Fee · payments", "P1 Full payment for Nov → Paid", due(s, [...sep, pay(s, 5000, ["2026-11"])]).kind, "paid");
    eq("Fee · payments", "P2 Part payment ₹2,000 → Partial, balance ₹3,000, overdue 3 days", (() => { const d = C.feeDue(s, [...sep, pay(s, 2000, ["2026-11"])]); return [d.status, d.balance, d.label]; })(), ["Partial", 3000, "Overdue 3 days"]);
    eq("Fee · payments", "P3 Two part payments 2,000 + 3,000 → Paid", C.feeFor(s, [pay(s, 2000, ["2026-11"]), pay(s, 3000, ["2026-11"])], "2026-11").status, "Paid");
    const adv = [pay(s, 15000, ["2026-11", "2026-12", "2027-01"])];
    eq("Fee · payments", "P4 ₹15,000 for 3 months → each month Paid", ["2026-11", "2026-12", "2027-01"].map((k) => C.feeFor(s, adv, k).status), ["Paid", "Paid", "Paid"]);
    const adv2 = [pay(s, 12000, ["2026-11", "2026-12", "2027-01"])];
    eq("Fee · payments", "P5 ₹12,000 for 3 months → each ₹4,000 paid, ₹1,000 balance", ["2026-11", "2026-12", "2027-01"].map((k) => C.feeFor(s, adv2, k).balance), [1000, 1000, 1000]);
    eq("Fee · payments", "P6 Overpaid ₹6,000 for one month → Paid, balance 0", (() => { const f = C.feeFor(s, [pay(s, 6000, ["2026-11"])], "2026-11"); return [f.status, f.balance]; })(), ["Paid", 0]);
    eq("Fee · payments", "P7 Oct unpaid + Nov paid → Nov paid, Oct ₹5,000 still shown", (() => { const d = C.feeDue(s, [pay(s, 5000, ["2026-09"]), pay(s, 5000, ["2026-11"])]); return [d.kind, d.prevDue]; })(), ["paid", 5000]);

    // ───────── FEES: GST ─────────
    s = S({ joinDate: "2026-09-01", gst: true });
    eq("Fee · GST", "G1 ₹5,000 + 18% → ₹5,900 / month", C.feeParts(s), { base: 5000, gst: 900, total: 5900, on: true });
    eq("Fee · GST", "G2 Paid ₹5,900 → Paid", C.feeFor(s, [pay(s, 5900, ["2026-11"])], "2026-11").status, "Paid");
    eq("Fee · GST", "G3 Paid only ₹5,000 → Partial, ₹900 balance", (() => { const f = C.feeFor(s, [pay(s, 5000, ["2026-11"])], "2026-11"); return [f.status, f.balance]; })(), ["Partial", 900]);
    eq("Fee · GST", "G4 Receipt split of ₹5,900 → 5,000 + CGST 450 + SGST 450", C.splitGst(5900), { total: 5900, taxable: 5000, gst: 900, cgst: 450, sgst: 450 });
    eq("Fee · GST", "G5 ₹17,700 for 3 months → each month Paid", ["2026-11", "2026-12", "2027-01"].map((k) => C.feeFor(s, [pay(s, 17700, ["2026-11", "2026-12", "2027-01"])], k).status), ["Paid", "Paid", "Paid"]);
    eq("Fee · GST", "G6 GST off → ₹5,000", C.feeParts(S({ gst: false })).total, 5000);

    // ───────── FEES: changes after joining ─────────
    s = S({ joinDate: "2026-09-04" });
    const paidSepOct = [pay(s, 5000, ["2026-09"]), pay(s, 5000, ["2026-10"])];
    const raised = { ...s, monthlyFee: 6000, feeHistory: [{ from: "2026-09", monthlyFee: 5000, gst: false }, { from: "2026-11", monthlyFee: 6000, gst: false }] };
    eq("Fee · changes", "H1 Fee raised 5,000 → 6,000 from Nov: Sep & Oct (paid at 5,000) stay Paid", ["2026-09", "2026-10"].map((k) => C.feeFor(raised, paidSepOct, k).status), ["Paid", "Paid"]);
    eq("Fee · changes", "H2 …no false 'last month' balance in Nov", C.feeDue(raised, paidSepOct).prevDue, 0);
    eq("Fee · changes", "H3 …Nov uses new fee ₹6,000", C.feeFor(raised, paidSepOct, "2026-11").fee, 6000);
    const gstLater = { ...s, gst: true, feeHistory: [{ from: "2026-09", monthlyFee: 5000, gst: false }, { from: "2026-11", monthlyFee: 5000, gst: true }] };
    eq("Fee · changes", "H4 GST switched on from Nov: Oct stays ₹5,000 Paid, Nov is ₹5,900", [C.feeFor(gstLater, paidSepOct, "2026-10").status, C.feeFor(gstLater, paidSepOct, "2026-11").fee], ["Paid", 5900]);

    // ───────── SALARY (₹300 / hour, November 2026) ─────────
    const R = 300, M = (st) => { const l = T.salaryLine(st, R, "month", "2026-11"); return { classes: l.classes, hours: l.hours, amount: l.amount }; };
    const MWF = "Mon, Wed, Fri · 6 – 8 PM";
    eq("Salary · join date", "T1 Joined before Nov, Mon/Wed/Fri 6–8 PM → 13 classes × 2 h = 26 h = ₹7,800", M(S({ joinDate: "2026-09-01", schedule: MWF })), { classes: 13, hours: 26, amount: 7800 });
    eq("Salary · join date", "T2 Joined 15 Nov → counted from 15 Nov: 7 classes = 14 h = ₹4,200", M(S({ joinDate: "2026-11-15", schedule: MWF })), { classes: 7, hours: 14, amount: 4200 });
    eq("Salary · join date", "T3 Joined 4 Nov (today, Wed) → 4 Nov counted: 12 classes", M(S({ joinDate: "2026-11-04", schedule: MWF })).classes, 12);
    eq("Salary · join date", "T4 Joined 30 Nov (Mon) → 1 class", M(S({ joinDate: "2026-11-30", schedule: MWF })).classes, 1);
    eq("Salary · join date", "T5 Joins in December → ₹0 for November", M(S({ joinDate: "2026-12-01", schedule: MWF })).amount, 0);
    eq("Salary · join date", "T6 Joined Sep but tutor allocated 10 Nov → counted from 10 Nov: 9 classes", M(S({ joinDate: "2026-09-01", allocatedOn: "2026-11-10", schedule: MWF })).classes, 9);
    eq("Salary · join date", "T7 October salary, joined Tue 20 Oct (Mon/Wed/Fri) → 21, 23, 26, 28, 30 = 5 classes", T.salaryLine(S({ joinDate: "2026-10-20", schedule: MWF }), R, "month", "2026-10").classes, 5);

    eq("Salary · schedules", "T8 'Mon - Sat · 4:30 - 6 PM' → 25 classes × 1.5 h = ₹11,250", M(S({ joinDate: "2026-09-01", schedule: "Mon - Sat · 4:30 - 6 PM" })), { classes: 25, hours: 37.5, amount: 11250 });
    eq("Salary · schedules", "T9 'Daily · 7 - 8 AM' → 30 classes = ₹9,000", M(S({ joinDate: "2026-09-01", schedule: "Daily · 7 - 8 AM" })), { classes: 30, hours: 30, amount: 9000 });
    eq("Salary · schedules", "T10 'Weekdays · 10 AM – 12 PM' → 21 classes × 2 h = ₹12,600", M(S({ joinDate: "2026-09-01", schedule: "Weekdays · 10 AM – 12 PM" })), { classes: 21, hours: 42, amount: 12600 });
    eq("Salary · schedules", "T11 'Sat, Sun · 11 - 1 PM' → 9 classes × 2 h = ₹5,400", M(S({ joinDate: "2026-09-01", schedule: "Sat, Sun · 11 - 1 PM" })), { classes: 9, hours: 18, amount: 5400 });
    eq("Salary · schedules", "T12 'Tue, Thu' (no time) → 1 h default = 8 h", M(S({ joinDate: "2026-09-01", schedule: "Tue, Thu" })).hours, 8);
    eq("Salary · schedules", "T13 'Tue, Thu' + Hours per class 1.5 → 12 h = ₹3,600", M(S({ joinDate: "2026-09-01", schedule: "Tue, Thu", classHours: 1.5 })), { classes: 8, hours: 12, amount: 3600 });
    eq("Salary · schedules", "T14 No days in schedule → 0 + 'Set days' flag", T.salaryLine(S({ joinDate: "2026-09-01", schedule: "Evening 6-8 PM" }), R, "month", "2026-11").noDays, true);
    eq("Salary · schedules", "T15 Hours parse: 12-2 PM, 8 PM-9:30 PM, 6-7:30 AM", ["12 - 2 PM", "8 PM - 9:30 PM", "6 - 7:30 AM"].map(T.parseHours), [2, 1.5, 1.5]);
    eq("Salary · schedules", "T16 Saved class days override schedule text", M(S({ joinDate: "2026-09-01", schedule: MWF, classDays: "Tue, Thu" })).classes, 8);

    const ctxT = (students, payouts = []) => ({ students, tutorPayouts: payouts });
    const tA = { id: "tA", name: "Tutor A", fee: R }, tB = { id: "tB", name: "Tutor B", fee: R };
    const a1 = S({ id: "a1", joinDate: "2026-09-01", schedule: MWF, tutorId: "tA" });
    const a2 = S({ id: "a2", joinDate: "2026-11-15", schedule: "Sat, Sun · 11 - 1 PM", tutorId: "tA" });
    const a3 = S({ id: "a3", joinDate: "2026-09-01", schedule: MWF, tutorId: "tB" });
    eq("Salary · tutor total", "T17 Tutor A: student joined Sep (₹7,800) + student joined 15 Nov Sat/Sun (5 classes ₹3,000) = ₹10,800", T.tutorGross(ctxT([a1, a2, a3]), tA, "month", "2026-11").gross, 10800);
    eq("Salary · tutor total", "T18 Another tutor's students are not counted", T.tutorGross(ctxT([a1, a2, a3]), tB, "month", "2026-11").gross, 7800);

    // tutor changed mid-month: A taught from Sep, B took over on 16 Nov
    const moved = S({ id: "mv", joinDate: "2026-09-01", schedule: MWF, tutorId: "tB", allocatedOn: "2026-11-16",
      allocationHistory: [{ tutorId: "tA", tutorName: "Tutor A", on: "2026-09-01" }, { tutorId: "tB", tutorName: "Tutor B", on: "2026-11-16" }] });
    eq("Salary · changes", "X1 Tutor changed on 16 Nov → old tutor A paid for 1–15 Nov (6 classes = ₹3,600)", T.tutorGross(ctxT([moved]), tA, "month", "2026-11").gross, 3600);
    eq("Salary · changes", "X2 …new tutor B paid from 16 Nov (7 classes = ₹4,200)", T.tutorGross(ctxT([moved]), tB, "month", "2026-11").gross, 4200);
    eq("Salary · changes", "X3 …old tutor A's October salary still counts the student (13 classes)", T.tutorGross(ctxT([moved]), tA, "month", "2026-10").lines.reduce((a, l) => a + l.classes, 0), 13);
    // student stopped on 20 Nov
    const left = S({ id: "lf", joinDate: "2026-09-01", schedule: MWF, tutorId: "tA", status: "Inactive", leftOn: "2026-11-20" });
    eq("Salary · changes", "X4 Student stopped 20 Nov → tutor still paid 1–20 Nov (9 classes = ₹5,400)", T.tutorGross(ctxT([left]), tA, "month", "2026-11").gross, 5400);
    eq("Salary · changes", "X5 …and full October (13 classes = ₹7,800)", T.tutorGross(ctxT([left]), tA, "month", "2026-10").gross, 7800);
    eq("Salary · changes", "X6 …nothing in December", T.tutorGross(ctxT([left]), tA, "month", "2026-12").gross, 0);

    // legacy data (no history) changed via allocationPatch
    const legacy = S({ id: "lg", joinDate: "2026-09-01", schedule: MWF, tutorId: "tA", tutorName: "Tutor A", allocatedOn: "2026-09-01" });
    const lgMoved = { ...legacy, ...C.allocationPatch(legacy, { id: "tB", name: "Tutor B", phone: "9000000000" }, "2026-11-16", "x") };
    eq("Salary · changes", "X7 Older student (no history) moved to B on 16 Nov → A keeps 1–15 Nov ₹3,600", T.tutorGross(ctxT([lgMoved]), tA, "month", "2026-11").gross, 3600);
    eq("Salary · changes", "X8 …B gets 16–30 Nov ₹4,200", T.tutorGross(ctxT([lgMoved]), tB, "month", "2026-11").gross, 4200);
    const removed = { ...legacy, ...C.allocationPatch(legacy, null, "2026-11-11", "x") };
    eq("Salary · changes", "X9 Tutor removed on 11 Nov (no new tutor) → A paid 1–10 Nov (4 classes ₹2,400)", T.tutorGross(ctxT([removed]), tA, "month", "2026-11").gross, 2400);
    const backdated = { ...S({ id: "bd", joinDate: "2026-11-01", schedule: MWF }), ...C.allocationPatch(S({ joinDate: "2026-11-01" }), { id: "tA", name: "Tutor A" }, "2026-11-02", "x") };
    eq("Salary · changes", "X10 Allocated with start date 2 Nov → whole month 13 classes", T.tutorGross(ctxT([backdated]), tA, "month", "2026-11").lines[0].classes, 13);
    const oldStop = S({ joinDate: "2026-09-01", schedule: MWF, tutorId: "tA", status: "Inactive", updatedAt: new Date(2026, 9, 15, 11).getTime() });
    eq("Salary · changes", "X11 Old data: marked Inactive on 15 Oct (no last class date) → last class = 15 Oct", C.lastClassDate(oldStop), "2026-10-15");
    eq("Salary · changes", "X11b …tutor paid 1–15 Oct: 6 classes = ₹3,600", T.tutorGross(ctxT([oldStop]), tA, "month", "2026-10").gross, 3600);
    eq("Salary · changes", "X11c …and still listed on Fees for October", C.activeInMonth(oldStop, "2026-10"), true);
    eq("Salary · changes", "X12 Joined from booking with tutor (stint from join date 10 Nov) → 9 classes", T.tutorGross(ctxT([S({ joinDate: "2026-11-10", schedule: MWF, tutorId: "tA", allocatedOn: "2026-11-10", allocationHistory: [{ tutorId: "tA", on: "2026-11-10" }] })]), tA, "month", "2026-11").lines[0].classes, 9);
    eq("Salary · changes", "X13 Salary sheet lists both tutors for Nov after a move", [...T.tutorIdsInPeriod(ctxT([moved]), "month", "2026-11")].sort(), ["tA", "tB"]);
    eq("Salary · changes", "X14 …and only B for December", [...T.tutorIdsInPeriod(ctxT([moved]), "month", "2026-12")], ["tB"]);

    // fee correction for all months / Fees page month list
    const fixed = { ...s, monthlyFee: 4500, feeHistory: C.feeHistoryAfterChange(s, 4500, false, "2026-09") };
    eq("Fee · changes", "H5 Wrong fee corrected from joining month → every month uses ₹4,500", ["2026-09", "2026-10", "2026-11"].map((k) => C.feeFor(fixed, [], k).fee), [4500, 4500, 4500]);
    const raised2 = { ...s, monthlyFee: 6000, feeHistory: C.feeHistoryAfterChange(s, 6000, false, "2026-11") };
    eq("Fee · changes", "H6 Saving a raise from Nov builds history: Sep–Oct ₹5,000, Nov ₹6,000", ["2026-09", "2026-10", "2026-11", "2026-12"].map((k) => C.feeFor(raised2, [], k).fee), [5000, 5000, 6000, 6000]);
    const stop = S({ joinDate: "2026-09-04", status: "Inactive", leftOn: "2026-10-15" });
    eq("Fee · changes", "H7 Stopped 15 Oct → listed on Fees for Sep & Oct, not Nov", ["2026-08", "2026-09", "2026-10", "2026-11"].map((k) => C.activeInMonth(stop, k)), [false, true, true, false]);

    // ── Client rules (4 Nov 2026) ──
    s = S({ joinDate: "2026-10-10" });
    eq("Rules", "R1 Joined 10 Oct → first fee due 10 Oct (at joining)", C.dueDateFor(s, "2026-10").toLocaleDateString("en-CA"), "2026-10-10");
    eq("Rules", "R1b …Oct paid → next fee due on/before 10 Nov", due(s, [pay(s, 5000, ["2026-10"])]), { kind: "upcoming", label: "Due 10 Nov", balance: 5000, prevDue: 0, due: "2026-11-10" });
    eq("Rules", "R1c …every month on the 10th (Dec 10, Jan 10)", ["2026-12", "2027-01"].map((k) => C.dueDateFor(s, k).toLocaleDateString("en-CA")), ["2026-12-10", "2027-01-10"]);
    const r2 = S({ joinDate: "2026-10-10", schedule: MWF, tutorId: "tA", allocatedOn: "2026-10-10", allocationHistory: [{ tutorId: "tA", on: "2026-10-10" }] });
    eq("Rules", "R2 Joined & tutor allocated 10 Oct, Mon/Wed/Fri 2 h → Oct 9 classes = 18 h × ₹300 = ₹5,400", (() => { const l = T.tutorGross(ctxT([r2]), tA, "month", "2026-10").lines[0]; return [l.classes, l.hours, l.amount]; })(), [9, 18, 5400]);
    const r3 = { ...r2, ...C.allocationPatch(r2, { id: "tB", name: "Tutor B" }, "2026-10-20", "x") };
    eq("Rules", "R3 Tutor A 10–19 Oct, Tutor B effective 20 Oct → A: 12,14,16,19 Oct = 4 classes ₹2,400", T.tutorGross(ctxT([r3]), tA, "month", "2026-10").gross, 2400);
    eq("Rules", "R3b …B: 21,23,26,28,30 Oct = 5 classes ₹3,000 (A + B = 9 classes, nothing lost)", T.tutorGross(ctxT([r3]), tB, "month", "2026-10").gross, 3000);
    eq("Rules", "R3c Effective date before join date → blocked", C.checkEffectiveDate(r2, "2026-10-05", []) !== "", true);
    eq("Rules", "R3d Effective date before current tutor's start → blocked", C.checkEffectiveDate({ ...r2, joinDate: "2026-10-01" }, "2026-10-08", []) !== "", true);
    eq("Rules", "R3e Old tutor's October already paid, effective 25 Oct → blocked (would pay twice)", C.checkEffectiveDate({ ...r2, tutorName: "Tutor A" }, "2026-10-25", [{ tutorId: "tA", periodType: "month", periodKey: "2026-10", status: "Paid", periodLabel: "October 2026" }]) !== "", true);
    eq("Rules", "R3f …effective 1 Nov → allowed", C.checkEffectiveDate(r2, "2026-11-01", [{ tutorId: "tA", periodType: "month", periodKey: "2026-10", status: "Paid" }]), "");
    eq("Rules", "R5 Salary payable for October (complete), not November (in progress)", [C.periodComplete("month", "2026-10"), C.periodComplete("month", "2026-11")], [true, false]);
    eq("Rules", "R5b Default salary month = last completed month", T.payablePeriod(), "2026-10");
    eq("Rules", "R5c …on 1 Dec, November becomes payable", C.periodComplete("month", "2026-11", new Date(2026, 11, 1, 9)), true);

    eq("Salary · week", "W1 Week 2–8 Nov, student joined 4 Nov (Mon/Wed/Fri) → Wed + Fri = 2 classes", T.salaryLine(S({ joinDate: "2026-11-04", schedule: MWF }), R, "week", "2026-11-02").classes, 2);
    return out;
  });
  await b.close();
  let pass = 0;
  let group = "";
  for (const r of results) {
    if (r.group !== group) { group = r.group; console.log("\n## " + group); }
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `\n      expected ${r.expected}\n      got      ${r.actual}`}`);
    if (r.ok) pass++;
  }
  console.log(`\n${pass} / ${results.length} passed`);
  require("fs").writeFileSync(__dirname + "/logic-results.json", JSON.stringify(results, null, 1));
})();
