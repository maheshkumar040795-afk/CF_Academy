// Staff Config — create staff logins (email + password), roles, activate / deactivate
import { put, watch, createStaffAccount, resetPassword, isDemo, OWNERS } from "../db.js";
import { $, $$, esc, fmtDate, fmtPhone, normPhone, waLink, toast, modal, confirmBox, readFields, options, ICONS } from "./ui.js";

let root, ctx, unsub = null, staffRows = [], loaded = false;

const ROLE_HELP = {
  Staff: "Bookings, tutors, students, allocation, fees and receipts. Cannot delete records, see Reports or manage staff.",
  Admin: "Everything, including Reports, deleting records and creating staff logins."
};

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return "Cf@" + [...arr].map((n) => chars[n % chars.length]).join("");
}

function render(view, c) {
  root = view; ctx = c;
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Staff Config</h1><p>Create logins for your staff. Each person gets their own email and password.</p></div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(300px,400px) minmax(0,1fr);gap:20px;align-items:start" class="sc-grid">
      <form class="panel" id="sfForm" autocomplete="off">
        <h2>Create staff login</h2>
        <div class="form-grid" style="grid-template-columns:1fr">
          <div class="fld"><label for="sfName">Full name *</label><input id="sfName" name="name" maxlength="60" required></div>
          <div class="fld"><label for="sfEmail">Login email *</label><input id="sfEmail" name="email" type="email" maxlength="80" autocomplete="off" required></div>
          <div class="fld"><label for="sfPhone">Mobile</label><input id="sfPhone" name="phone" inputmode="numeric" maxlength="18"></div>
          <div class="fld"><label for="sfRole">Role</label><select id="sfRole" name="role">${options(["Staff", "Admin"], "Staff")}</select><span class="sub" id="sfRoleHelp">${esc(ROLE_HELP.Staff)}</span></div>
          <div class="fld"><label for="sfPass">Password * <span class="sub" style="display:inline">(min 8 characters)</span></label>
            <div style="display:flex;gap:6px"><input id="sfPass" name="password" type="text" minlength="8" maxlength="64" autocomplete="new-password" style="flex:1" required>
            <button type="button" class="btn btn-ghost btn-sm" id="sfGen" style="min-height:40px">Generate</button></div>
          </div>
        </div>
        <button class="btn btn-navy btn-block" type="submit" id="sfSave" style="margin-top:14px;min-height:46px">Create login</button>
        <p class="sub" style="margin:10px 0 0">The staff member signs in at <b>${esc(location.origin + location.pathname)}</b>. They can change their password any time with “Change my password”.</p>
      </form>
      <div>
        <div class="panel" style="margin-bottom:16px">
          <div class="panel-head"><h2>Owners</h2><span class="sub">Full access · set in js/firebase-config.js and firestore.rules</span></div>
          ${isDemo ? `<p class="sub" style="margin:0">Demo mode — any email that is not a staff login acts as owner.</p>` :
            OWNERS.map((e) => `<div style="padding:6px 0;border-bottom:1px solid var(--line-2)"><b style="color:var(--navy)">${esc(e)}</b> <span class="pill p-won">Owner</span></div>`).join("")}
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Staff logins</h2><span class="sub" id="sfCount"></span></div>
          <div id="sfList"></div>
        </div>
      </div>
    </div>`;
  const mq = window.matchMedia("(max-width: 1000px)");
  const grid = $(".sc-grid", view);
  const apply = () => { grid.style.gridTemplateColumns = mq.matches ? "1fr" : "minmax(300px,400px) minmax(0,1fr)"; };
  apply(); mq.addEventListener && mq.addEventListener("change", apply);

  $("#sfRole", view).addEventListener("change", (e) => { $("#sfRoleHelp", view).textContent = ROLE_HELP[e.target.value]; });
  $("#sfGen", view).addEventListener("click", () => { $("#sfPass", view).value = genPassword(); });
  $("#sfForm", view).addEventListener("submit", createLogin);
  $("#sfList", view).addEventListener("click", onListClick);

  loaded = false;
  renderList();
  watch("staff", (rows) => { staffRows = rows; loaded = true; renderList(); }, (err) => {
    $("#sfList", root).innerHTML = `<div class="note bad">Could not load staff: ${esc(err.message)}</div>`;
  }).then((u) => { unsub = u; });
}

async function createLogin(e) {
  e.preventDefault();
  const f = readFields(e.target);
  f.email = f.email.toLowerCase();
  if (!f.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { toast("Enter a name and a valid email", "bad"); return; }
  if ((f.password || "").length < 8) { toast("Password must be at least 8 characters", "bad"); return; }
  if (OWNERS.includes(f.email)) { toast("This email is already an owner login", "bad"); return; }
  if (staffRows.some((s) => s.email === f.email)) { toast("A staff login with this email already exists", "bad"); return; }
  const btn = $("#sfSave", root);
  btn.disabled = true; btn.textContent = "Creating…";
  try {
    const uid = await createStaffAccount(f.email, f.password);
    const doc = {
      id: uid, name: f.name, email: f.email, phone: normPhone(f.phone), role: f.role, active: true,
      createdAt: Date.now(), createdBy: ctx.user.email
    };
    if (isDemo) doc.demoPassword = f.password; // demo only — never stored with Firebase
    await put("staff", doc);
    showCredentials(f);
    e.target.reset();
    $("#sfRoleHelp", root).textContent = ROLE_HELP.Staff;
  } catch (ex) {
    const code = ex.code || "";
    toast(code.includes("email-already-in-use") ? "This email already has a Firebase login. Use another email, or remove the old user in Firebase console → Authentication."
      : code.includes("weak-password") ? "Password is too weak — use 8+ characters with letters and numbers."
      : code.includes("invalid-email") ? "That email address is not valid."
      : code.includes("operation-not-allowed") ? "Turn on Email/Password in Firebase console → Authentication → Sign-in method."
      : "Could not create login: " + ex.message, "bad");
  } finally {
    btn.disabled = false; btn.textContent = "Create login";
  }
}

function showCredentials(f) {
  const url = location.origin + location.pathname;
  const msg = `Hello ${f.name}, your CF Academy ${f.role.toLowerCase()} login is ready.\nLogin: ${url}\nEmail: ${f.email}\nPassword: ${f.password}\nPlease change your password after first login (Change my password).`;
  modal({
    title: "Login created",
    body: `
      <div class="note ok" style="margin-bottom:12px">Share these details with <b>${esc(f.name)}</b>. The password is not shown again.</div>
      <div class="kv" style="display:grid;grid-template-columns:90px 1fr;gap:8px 10px;font-size:14px">
        <span class="sub">Login page</span><b style="font-weight:500;word-break:break-all">${esc(url)}</b>
        <span class="sub">Email</span><b style="font-weight:500">${esc(f.email)}</b>
        <span class="sub">Password</span><b style="font-weight:600;font-family:monospace;font-size:15px">${esc(f.password)}</b>
        <span class="sub">Role</span><b style="font-weight:500">${esc(f.role)}</b>
      </div>`,
    actions: [
      { label: "Copy details", kind: "btn-ghost", onClick: async () => { try { await navigator.clipboard.writeText(msg); toast("Copied", "ok"); } catch (e) { toast("Copy not allowed — select and copy manually", "bad"); } return false; } },
      ...(f.phone ? [{ label: "Send on WhatsApp", kind: "btn-wa", onClick: () => { window.open(waLink(f.phone, msg), "_blank"); return false; } }] : []),
      { label: "Done", kind: "btn-navy" }
    ]
  });
}

function renderList() {
  const box = $("#sfList", root);
  if (!box) return;
  if (!loaded) { box.innerHTML = `<p class="sub">Loading…</p>`; return; }
  $("#sfCount", root).textContent = `${staffRows.filter((s) => s.active !== false).length} active · ${staffRows.length} total`;
  box.innerHTML = staffRows.length ? `
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Staff</th><th>Role · status</th><th></th></tr></thead>
      <tbody>${staffRows.map((s) => `
        <tr>
          <td><span class="strong">${esc(s.name)}</span><span class="sub" style="overflow-wrap:anywhere">${esc(s.email)}</span><span class="sub">${s.phone ? esc(fmtPhone(s.phone)) + " · " : ""}added ${esc(fmtDate(s.createdAt))}</span></td>
          <td>${esc(s.role || "Staff")}<br>${s.active === false ? '<span class="pill p-lost">Deactivated</span>' : '<span class="pill p-won">Active</span>'}</td>
          <td><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${esc(s.id)}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-act="reset" data-id="${esc(s.id)}">Reset password</button>
            ${s.active === false ? `<button class="btn btn-accent btn-sm" data-act="on" data-id="${esc(s.id)}">Activate</button>` : `<button class="btn btn-danger btn-sm" data-act="off" data-id="${esc(s.id)}">Deactivate</button>`}
          </div></td>
        </tr>`).join("")}</tbody></table></div>` : `<div class="empty">No staff logins yet. Create one on the left.</div>`;
}

async function onListClick(e) {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const s = staffRows.find((x) => x.id === b.dataset.id); if (!s) return;
  if (s.email === String(ctx.user.email).toLowerCase() && b.dataset.act === "off") { toast("You cannot deactivate your own login", "bad"); return; }
  if (b.dataset.act === "off") {
    if (!(await confirmBox("Deactivate login?", `<b>${esc(s.name)}</b> (${esc(s.email)}) will be signed out of the admin panel and cannot access any data until you activate them again.`, "Deactivate"))) return;
    await put("staff", { id: s.id, active: false, deactivatedBy: ctx.user.email, deactivatedAt: Date.now() });
    toast(s.name + " deactivated");
  }
  if (b.dataset.act === "on") { await put("staff", { id: s.id, active: true }); toast(s.name + " activated", "ok"); }
  if (b.dataset.act === "reset") {
    try { await resetPassword(s.email); toast("Password reset link emailed to " + s.email, "ok"); }
    catch (ex) { toast(ex.message, "bad"); }
  }
  if (b.dataset.act === "edit") {
    modal({
      title: "Edit staff",
      body: `<div class="form-grid" id="seForm">
        <div class="fld full"><label>Name</label><input name="name" value="${esc(s.name)}"></div>
        <div class="fld"><label>Mobile</label><input name="phone" value="${esc(s.phone || "")}"></div>
        <div class="fld"><label>Role</label><select name="role">${options(["Staff", "Admin"], s.role || "Staff")}</select></div>
        <div class="fld full"><span class="sub">Login email cannot be changed here (${esc(s.email)}). To use a different email, create a new login and deactivate this one.</span></div>
      </div>`,
      actions: [{ label: "Cancel" }, { label: "Save", kind: "btn-navy", onClick: async (close, m) => {
        const f = readFields($("#seForm", m));
        if (!f.name) { toast("Name is required", "bad"); return false; }
        await put("staff", { id: s.id, name: f.name, phone: normPhone(f.phone), role: f.role });
        toast("Saved", "ok");
      } }]
    });
  }
}

function destroy() { unsub && unsub(); unsub = null; }

export default { deps: [], render, refresh() {}, destroy };
