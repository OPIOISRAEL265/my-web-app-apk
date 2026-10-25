/* Smart Lost & Found — MUST. Plain JS port of the Flutter client.
   Data lives in localStorage (no backend needed). Demo password: Must@2024 */
const $ = (s, e = document) => e.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATS = ['Phone','Laptop','Wallet','ID Card','Keys','Bag','Clothing','Books','Earphones','Other'];
const LOCS = ['Main Library','Computing Faculty','Cafeteria','Main Gate','Lecture Hall A','Sports Ground','Hostel Block B'];
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const day = n => new Date(Date.now() - n * 864e5).toISOString();

function seed() {
  const u = (email, name, role) => ({ id: uid(), email, name, role, password: 'Must@2024', active: true });
  const users = [u('admin@must.ac.ug','Administrator','admin'), u('security@must.ac.ug','Security Office','officer'),
    u('robert.mugisha@must.ac.ug','Robert Mugisha','officer'), u('ikiram.said@student.must.ac.ug','Ikiram Said','student'),
    u('student2@student.must.ac.ug','Amina Nakato','student')];
  const r = (type, title, category, color, brand, location, d, status, by, desc) =>
    ({ id: uid(), ref: (type === 'Lost' ? 'LST-' : 'FND-') + (1000 + Math.floor(Math.random() * 9000)), type, title, category, color, brand, location, date: day(d), status, by, desc, photo: '', created: day(d) });
  const reports = [
    r('Lost','Black Samsung phone','Phone','Black','Samsung','Main Library',2,'Lost',users[3].id,'Cracked corner, blue case.'),
    r('Found','Samsung phone, black','Phone','Black','Samsung','Main Library',1,'Found – In Custody',users[4].id,'Handed to security desk.'),
    r('Found','Brown leather wallet','Wallet','Brown','','Cafeteria',3,'Found – In Custody',users[1].id,'Contains no cash.'),
    r('Lost','HP laptop','Laptop','Silver','HP','Computing Faculty',4,'Lost',users[4].id,'Sticker of a mountain on the lid.')];
  return { users, reports, claims: [], notes: [] };
}
let db = JSON.parse(localStorage.getItem('cf.db') || 'null') || seed();
const save = () => localStorage.setItem('cf.db', JSON.stringify(db));
const S = { user: db.users.find(x => x.id === localStorage.getItem('cf.session')) || null, tab: 'home', auth: 'login', q: '', ft: '', fc: '', fs: '', modal: null };
const byId = (list, id) => db[list].find(x => x.id === id);
const notify = (uid_, text) => { db.notes.unshift({ id: uid(), to: uid_, text, at: now(), read: false }); };
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); }

// ---------- matching (weights from the Flutter/FastAPI engine) ----------
function score(a, b) {
  let s = 0; const why = [];
  if (a.category === b.category) { s += .26; why.push('Same category'); }
  const wa = a.title.toLowerCase().split(/\W+/), wb = b.title.toLowerCase().split(/\W+/);
  const common = wa.filter(w => w.length > 2 && wb.includes(w)).length;
  if (common) { s += Math.min(.17, .06 * common); why.push('Similar title'); }
  if (a.location === b.location) { s += .13; why.push('Same location'); }
  if (a.color && a.color.toLowerCase() === b.color.toLowerCase()) { s += .12; why.push('Same colour'); }
  if (a.brand && a.brand.toLowerCase() === b.brand.toLowerCase()) { s += .12; why.push('Same brand'); }
  if (Math.abs(new Date(a.date) - new Date(b.date)) < 14 * 864e5) { s += .12; why.push('Dates within 14 days'); }
  return { pct: Math.round(s * 100), why };
}
const matchesFor = r => db.reports.filter(o => o.type !== r.type && o.status !== 'Returned' && o.status !== 'Withdrawn')
  .map(o => ({ o, ...score(r, o) })).filter(m => m.pct >= 25).sort((a, b) => b.pct - a.pct);

// ---------- views ----------
const fmt = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const opts = (arr, sel) => arr.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');

function landing() {
  const reg = S.auth === 'register';
  return `<div class="hero"><h1>🔎 Smart Lost &amp; Found</h1><p>Mbarara University of Science and Technology. Report lost or found property, get match suggestions and have ownership verified before handover.</p></div>
  <div class="auth card"><div class="tabs"><button class="${reg ? 'ghost' : ''}" data-act="auth" data-v="login">Sign in</button><button class="${reg ? '' : 'ghost'}" data-act="auth" data-v="register">Register</button></div>
  <form data-form="${reg ? 'register' : 'login'}">${reg ? '<label>Full name</label><input name="name" required>' : ''}
  <label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" required minlength="6">
  <p><button style="width:100%">${reg ? 'Create student account' : 'Sign in'}</button></p></form>
  ${reg ? '' : '<p class="muted">Demo: admin@must.ac.ug · security@must.ac.ug · ikiram.said@student.must.ac.ug<br>Password: Must@2024</p>'}</div>`;
}

function shell() {
  const role = S.user.role;
  const tabs = { student: [['home','Dashboard'],['browse','Browse'],['report','Report item'],['mine','My reports'],['notes','Notifications']],
    officer: [['queue','Verification'],['browse','Browse'],['notes','Notifications']],
    admin: [['home','Dashboard'],['browse','Browse'],['users','Users'],['queue','Claims']] }[role];
  if (!tabs.some(t => t[0] === S.tab)) S.tab = tabs[0][0];
  const unread = db.notes.filter(n => n.to === S.user.id && !n.read).length;
  return `<header class="top"><b>🔎 Campus Find</b><nav>${tabs.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}${k === 'notes' && unread ? ` (${unread})` : ''}</button>`).join('')}</nav>
  <span class="sp"></span><span class="muted" style="color:#cbd5f5">${esc(S.user.name)} · ${role}</span><button class="ghost sm" data-act="logout">Sign out</button></header>
  <main>${views[S.tab]()}</main>${S.modal ? detail(byId('reports', S.modal)) : ''}`;
}

function card(r) {
  return `<div class="card item" data-act="open" data-v="${r.id}">${r.photo ? `<img src="${r.photo}" alt="">` : '<div class="photo"></div>'}
  <div class="row"><span class="pill ${r.type}">${r.type}</span><span class="pill">${esc(r.status)}</span></div>
  <h3 style="margin-top:8px">${esc(r.title)}</h3><div class="muted">${esc(r.category)} · ${esc(r.location)} · ${fmt(r.date)}</div></div>`;
}

const views = {
  home() {
    const R = db.reports, mine = R.filter(r => r.by === S.user.id);
    const st = S.user.role === 'admin'
      ? [['Total reports', R.length], ['Lost', R.filter(r => r.type === 'Lost').length], ['Found', R.filter(r => r.type === 'Found').length],
         ['Returned', R.filter(r => r.status === 'Returned').length], ['Open claims', db.claims.filter(c => c.status === 'Pending Verification').length], ['Users', db.users.length]]
      : [['My reports', mine.length], ['My claims', db.claims.filter(c => c.by === S.user.id).length], ['Returned to me', mine.filter(r => r.status === 'Returned').length]];
    const cats = CATS.map(c => [c, R.filter(r => r.category === c).length]).filter(x => x[1]);
    return `<h2>Dashboard</h2><div class="stats">${st.map(([l, n]) => `<div class="stat"><b>${n}</b><span class="muted">${l}</span></div>`).join('')}</div>
    <div class="card"><h3>Reports by category</h3>${cats.length ? cats.map(([c, n]) => `<div class="row"><span style="width:110px">${c}</span><div class="bar"><i style="width:${n / R.length * 100}%"></i></div> ${n}</div>`).join('') : '<p class="muted">No reports yet.</p>'}</div>
    <h3>Latest reports</h3><div class="grid">${R.slice(-4).reverse().map(card).join('')}</div>`;
  },
  browse() {
    const q = S.q.toLowerCase();
    const list = db.reports.filter(r => (!S.ft || r.type === S.ft) && (!S.fc || r.category === S.fc) && (!S.fs || r.status === S.fs)
      && (!q || (r.title + r.brand + r.color + r.location + r.desc).toLowerCase().includes(q)));
    return `<h2>Browse reports</h2><div class="filters"><input id="q" placeholder="Search keyword…" value="${esc(S.q)}">
    <select data-filter="ft"><option value="">All types</option>${opts(['Lost', 'Found'], S.ft)}</select>
    <select data-filter="fc"><option value="">All categories</option>${opts(CATS, S.fc)}</select>
    <select data-filter="fs"><option value="">All statuses</option>${opts(['Lost','Found – In Custody','Matched','Claim Pending','Returned','Withdrawn'], S.fs)}</select></div>
    <div class="grid">${list.map(card).join('') || '<p class="muted">No reports match your filters.</p>'}</div>`;
  },
  report() {
    return `<h2>Report an item</h2><form class="card" data-form="report">
    <label>Type</label><select name="type"><option>Lost</option><option>Found</option></select>
    <label>Title</label><input name="title" required placeholder="e.g. Blue umbrella">
    <div class="row"><div style="flex:1"><label>Category</label><select name="category">${opts(CATS)}</select></div><div style="flex:1"><label>Location</label><select name="location">${opts(LOCS)}</select></div></div>
    <div class="row"><div style="flex:1"><label>Colour</label><input name="color"></div><div style="flex:1"><label>Brand</label><input name="brand"></div></div>
    <label>Date</label><input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}">
    <label>Description</label><textarea name="desc"></textarea><label>Photo (max 500 KB)</label><input name="photo" type="file" accept="image/*">
    <p><button>Submit report</button></p></form>`;
  },
  mine() {
    const l = db.reports.filter(r => r.by === S.user.id);
    return `<h2>My reports</h2><div class="grid">${l.map(card).join('') || '<p class="muted">You have not reported anything yet.</p>'}</div>`;
  },
  notes() {
    db.notes.filter(n => n.to === S.user.id).forEach(n => n.read = true); save();
    const l = db.notes.filter(n => n.to === S.user.id);
    return `<h2>Notifications</h2>${l.map(n => `<div class="card">${esc(n.text)}<div class="muted">${fmt(n.at)}</div></div>`).join('') || '<p class="muted">Nothing yet.</p>'}`;
  },
  queue() {
    const l = db.claims.filter(c => S.user.role === 'admin' || true);
    return `<h2>Claims &amp; verification</h2>${l.map(c => {
      const r = byId('reports', c.report), cl = byId('users', c.by);
      return `<div class="card"><div class="row"><b>${esc(c.ref)}</b><span class="pill">${esc(c.status)}</span></div>
      <p>${esc(r?.title)} — claimed by ${esc(cl?.name)}</p><p class="muted">Evidence: ${esc(c.evidence)}</p>${c.reason ? `<p class="muted">Officer note: ${esc(c.reason)}</p>` : ''}
      <div class="row">${c.status === 'Pending Verification' || c.status === 'More Information Required' ? `<button class="ok sm" data-act="verdict" data-id="${c.id}" data-v="Verified">Verify</button>
        <button class="ghost sm" data-act="verdict" data-id="${c.id}" data-v="More Information Required">Need info</button><button class="bad sm" data-act="verdict" data-id="${c.id}" data-v="Rejected">Reject</button>` : ''}
      ${c.status === 'Verified' ? `<button class="sm" data-act="handover" data-id="${c.id}">Record handover</button>` : ''}</div></div>`;
    }).join('') || '<p class="muted">No claims submitted yet.</p>'}`;
  },
  users() {
    return `<h2>Users</h2><div class="card" style="overflow:auto"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr>${db.users.map(u =>
      `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><select data-role="${u.id}">${['student', 'officer', 'admin'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
      <td><button class="ghost sm" data-act="toggle" data-v="${u.id}">${u.active ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('')}</table></div>`;
  }
};

function detail(r) {
  const owner = byId('users', r.by), mine = r.by === S.user.id, priv = mine || S.user.role !== 'student';
  const ms = matchesFor(r).slice(0, 3), canClaim = S.user.role === 'student' && !mine && r.type === 'Found' && r.status === 'Found – In Custody';
  return `<div class="modal" data-act="close"><div class="card" data-stop>${r.photo ? `<img class="photo" style="height:200px" src="${r.photo}">` : ''}
  <div class="row"><span class="pill ${r.type}">${r.type}</span><span class="pill">${esc(r.status)}</span><span class="muted">${esc(r.ref)}</span></div>
  <h2 style="margin-top:8px">${esc(r.title)}</h2><p>${esc(r.desc) || '<i class="muted">No description</i>'}</p>
  <p class="muted">${esc(r.category)} · ${esc(r.color || '—')} · ${esc(r.brand || '—')} · ${esc(r.location)} · ${fmt(r.date)}<br>Reported by ${priv ? esc(owner?.name) : 'a campus member (name hidden)'}</p>
  ${ms.length ? `<h3>Suggested matches</h3>${ms.map(m => `<div class="card item" data-act="open" data-v="${m.o.id}"><b>${m.pct}%</b> ${esc(m.o.title)} <span class="muted">— ${m.why.join(', ')}</span></div>`).join('')}<p class="muted">Matches are suggestions only and never prove ownership.</p>` : ''}
  ${canClaim ? `<form data-form="claim" data-id="${r.id}"><h3>Claim this item</h3><label>Describe distinguishing marks only the owner would know</label><textarea name="evidence" required></textarea><p><button>Submit claim</button></p></form>` : ''}
  <div class="row">${mine && r.status !== 'Returned' ? `<button class="ghost sm" data-act="withdraw" data-v="${r.id}">Withdraw report</button>` : ''}<button class="ghost sm" data-act="close">Close</button></div></div></div>`;
}

// ---------- actions ----------
const A = {
  auth: d => { S.auth = d.v; render(); },
  tab: d => { S.tab = d.v; S.modal = null; render(); },
  open: (d, e) => { e.stopPropagation(); S.modal = d.v; render(); },
  close: (d, e) => { if (e.target.closest('[data-stop]') && !e.target.matches('button')) return; S.modal = null; render(); },
  logout: () => { localStorage.removeItem('cf.session'); S.user = null; S.modal = null; render(); },
  withdraw: d => { byId('reports', d.v).status = 'Withdrawn'; save(); S.modal = null; render(); toast('Report withdrawn'); },
  toggle: d => { const u = byId('users', d.v); if (u.id === S.user.id) return toast('You cannot deactivate yourself'); u.active = !u.active; save(); render(); },
  verdict: d => {
    const c = byId('claims', d.id); let reason = '';
    if (d.v !== 'Verified') { reason = prompt('Reason (required):'); if (!reason) return toast('A reason is required'); }
    c.status = d.v; c.reason = reason; c.officer = S.user.id; save();
    notify(c.by, `Your claim ${c.ref} is now: ${d.v}.${reason ? ' ' + reason : ''}`);
    render(); toast('Decision recorded');
  },
  handover: d => {
    const c = byId('claims', d.id); c.status = 'Returned'; byId('reports', c.report).status = 'Returned'; c.handover = now(); save();
    notify(c.by, `Handover recorded for ${c.ref}. Your item has been returned.`); render(); toast('Item marked returned');
  }
};
const read = f => new Promise(res => { if (!f || !f.size) return res(''); if (f.size > 5e5) { toast('Photo too large, skipped'); return res(''); } const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
const F = {
  login: f => {
    const u = db.users.find(x => x.email === f.email.value.trim().toLowerCase() && x.password === f.password.value);
    if (!u) return toast('Wrong email or password'); if (!u.active) return toast('Account is deactivated');
    S.user = u; localStorage.setItem('cf.session', u.id); S.tab = 'home'; render();
  },
  register: f => {
    const email = f.email.value.trim().toLowerCase();
    if (db.users.some(x => x.email === email)) return toast('Email already registered');
    const u = { id: uid(), email, name: f.name.value.trim(), role: 'student', password: f.password.value, active: true };
    db.users.push(u); save(); S.user = u; localStorage.setItem('cf.session', u.id); render();
  },
  report: async f => {
    const photo = await read(f.photo.files[0]), type = f.type.value;
    const r = { id: uid(), ref: (type === 'Lost' ? 'LST-' : 'FND-') + (1000 + Math.floor(Math.random() * 9000)), type, title: f.title.value, category: f.category.value,
      color: f.color.value, brand: f.brand.value, location: f.location.value, date: new Date(f.date.value).toISOString(), status: type === 'Lost' ? 'Lost' : 'Found – In Custody',
      by: S.user.id, desc: f.desc.value, photo, created: now() };
    db.reports.push(r); const m = matchesFor(r)[0];
    if (m && m.pct >= 45) { notify(S.user.id, `Possible match (${m.pct}%) for "${r.title}": ${m.o.title}`); if (m.o.by !== S.user.id) notify(m.o.by, `Possible match (${m.pct}%) for "${m.o.title}": ${r.title}`); }
    save(); S.tab = 'mine'; S.modal = r.id; render(); toast('Report submitted');
  },
  claim: f => {
    const r = byId('reports', f.dataset.id);
    if (db.claims.some(c => c.report === r.id && c.by === S.user.id)) return toast('You already claimed this item');
    const c = { id: uid(), ref: 'CLM-' + (1000 + Math.floor(Math.random() * 9000)), report: r.id, by: S.user.id, evidence: f.evidence.value, status: 'Pending Verification', reason: '' };
    db.claims.push(c); r.status = 'Claim Pending';
    db.users.filter(u => u.role === 'officer').forEach(u => notify(u.id, `New claim ${c.ref} awaiting verification.`));
    save(); S.modal = null; render(); toast('Claim submitted for verification');
  }
};

document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t && A[t.dataset.act]) A[t.dataset.act](t.dataset, e); });
document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (f) { e.preventDefault(); F[f.dataset.form](f); } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.filter) { S[t.dataset.filter] = t.value; render(); }
  if (t.dataset.role) { byId('users', t.dataset.role).role = t.value; save(); toast('Role updated'); }
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; const p = e.target.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(p, p); } });

function render() { $('#app').innerHTML = S.user ? shell() : landing(); }
render();
