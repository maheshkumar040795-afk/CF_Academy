// Dashboard — today at a glance
import { $, esc, fmtDateTime, fmtPhone, inr, monthKey, monthLabel, ICONS } from "./ui.js";
import { statusPill, isOverdue, feeFor } from "./common.js";

let root, ctx;

function render(view, c) {
  root = view; ctx = c;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  view.innerHTML = `
    <div class="page-head">
      <div><h1>${greet}</h1><p>${esc(new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</p></div>
      <div class="actions"><a class="btn btn-accent" href="#/bookings">Open bookings</a><a class="btn btn-ghost" href="#/receipts">${ICONS.plus}Record payment</a></div>
    </div>
    <div class="stats" id="dStats"></div>
    <div class="grid2">
      <div class="panel"><div class="panel-head"><h2>Latest bookings</h2><a href="#/bookings" class="link-btn">View all</a></div><div id="dLatest"></div></div>
      <div class="panel"><div class="panel-head"><h2>Needs attention</h2></div><div id="dAttention"></div></div>
    </div>`;
  refresh();
  if (ctx.tutors == null) ctx.ensureTutors().catch(() => {});
}

function refresh() {
  if (!root || !document.body.contains(root)) return;
  const today = new Date().toDateString();
  const todays = ctx.bookings.filter((b) => new Date(b.createdAt).toDateString() === today).length;
  const overdue = ctx.bookings.filter(isOverdue);
  const fresh = ctx.bookings.filter((b) => b.status === "New");
  const active = ctx.students.filter((s) => (s.status || "Active") === "Active");
  const mk = monthKey();
  const collected = ctx.payments.filter((p) => (p.date || "").slice(0, 7) === mk).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const dues = active.map((s) => feeFor(s, ctx.payments, mk)).filter((f) => f.balance > 0);
  const dueAmt = dues.reduce((a, f) => a + f.balance, 0);

  $("#dStats", root).innerHTML = `
    <div class="stat"><span>New bookings today</span><b>${todays}</b></div>
    <div class="stat ${fresh.length ? "warn" : ""}"><span>Waiting for a call</span><b>${fresh.length}</b></div>
    <div class="stat ${overdue.length ? "bad" : ""}"><span>Not called in 2 hours</span><b>${overdue.length}</b></div>
    <div class="stat"><span>Active students</span><b>${active.length}</b></div>
    <div class="stat good"><span>Collected · ${esc(monthLabel(mk).split(" ")[0])}</span><b>${inr(collected)}</b></div>
    <div class="stat"><span>Pending fees · ${esc(monthLabel(mk).split(" ")[0])}</span><b>${inr(dueAmt)}</b></div>
    <div class="stat"><span>Tutors</span><b>${ctx.tutors ? ctx.tutors.length : "…"}</b></div>`;

  const latest = ctx.bookings.slice(0, 6);
  $("#dLatest", root).innerHTML = !ctx.loaded.bookings ? `<p class="sub">Loading…</p>` : latest.length ? `
    <div class="table-wrap"><table class="t"><tbody>${latest.map((b) => `
      <tr class="clickable" onclick="location.hash='#/bookings?id=${esc(b.id)}'">
        <td><span class="strong">${esc(b.parentName)}</span><span class="sub">${esc(fmtDateTime(b.createdAt))} · ${esc(fmtPhone(b.phone))}</span></td>
        <td>${esc(b.subjects)}<span class="sub">${esc(b.mode === "Online tuition" ? "Online" : [b.area, b.city].filter(Boolean).join(", "))}</span></td>
        <td>${statusPill(b)}</td>
      </tr>`).join("")}</tbody></table></div>` : `<p class="sub">No bookings yet. They will appear here the moment a parent books on the website.</p>`;

  const noTutor = ctx.bookings.filter((b) => ["Called", "Demo fixed"].includes(b.status) && !b.tutorId);
  const follow = ctx.bookings.filter((b) => b.followUp && b.followUp <= new Date().toISOString().slice(0, 10) && !["Converted", "Not interested"].includes(b.status));
  const items = [
    ...overdue.map((b) => ({ t: `Call <b>${esc(b.parentName)}</b> — booked ${esc(fmtDateTime(b.createdAt))}`, id: b.id, k: "p-late", l: "Call now" })),
    ...follow.map((b) => ({ t: `Follow up with <b>${esc(b.parentName)}</b> (${esc(b.subjects)})`, id: b.id, k: "p-demo", l: "Follow-up" })),
    ...noTutor.map((b) => ({ t: `Assign a tutor for <b>${esc(b.studentName || b.parentName)}</b> · ${esc(b.subjects)}`, id: b.id, k: "p-assigned", l: "Assign" }))
  ].slice(0, 10);
  $("#dAttention", root).innerHTML = items.length ? items.map((i) => `
    <a href="#/bookings?id=${esc(i.id)}" style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line-2);text-decoration:none;color:inherit">
      <span>${i.t}</span><span class="pill ${i.k}">${i.l}</span></a>`).join("") +
    (dues.length ? `<a href="#/fees" style="display:flex;justify-content:space-between;gap:10px;padding:10px 0;text-decoration:none;color:inherit"><span><b>${dues.length}</b> students have fees pending this month</span><span class="pill p-due">Fees</span></a>` : "")
    : `<div class="note ok">All caught up. No pending calls or follow-ups.</div>`;
}

export default { deps: ["bookings", "students", "payments", "tutors"], render, refresh };
