// VDI TimeKeeper app logic. Uses Firebase Auth (sign-in) and Firestore (data).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, writeBatch, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, MANAGER_UID } from "./config.js";

/* ---------- helpers ---------- */
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const RR = ['MO','TU','WE','TH','FR','SA','SU'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const dowIdx = d => (d.getDay() + 6) % 7;
const weekStart = t => { const x = new Date(t); x.setHours(0,0,0,0); x.setDate(x.getDate() - dowIdx(x)); return x; };
const wkKey = t => { const s = weekStart(t); return `${s.getFullYear()}-${pad(s.getMonth()+1)}-${pad(s.getDate())}`; };
const keyDate = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
const isoWeek = d => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - n); const y = new Date(Date.UTC(x.getUTCFullYear(),0,1)); return Math.ceil(((x - y) / 864e5 + 1) / 7); };
const fT = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fD = t => new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const fH = ms => (ms / 36e5).toFixed(2);
const hhmm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const minsToClock = m => { const d = new Date(); d.setHours(0, Math.round(m), 0, 0); return fT(d); };
const fmtRem = s => { if (!s) return '—'; const [h,m] = s.split(':').map(Number); const d = new Date(); d.setHours(h,m,0,0); return fT(d); };
const ms = v => v == null ? null : (typeof v.toMillis === 'function' ? v.toMillis() : Number(v));
let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3500); }
const isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function failMsg(e) {
  const c = e?.code || '';
  if (c === 'permission-denied') return "That wasn't allowed. Ask your manager to check your account.";
  if (c === 'unavailable') return "You're offline. Connect and try again.";
  return "That didn't save. Check your connection and try again.";
}
function setViewAttr(v) { document.body.dataset.view = v; }

/* ---------- service worker (install to home screen) ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; renderInstall(); });
function renderInstall() {
  const el = $('#install');
  if (standalone() || !isPhone || document.body.dataset.view === 'team') { el.hidden = true; return; }
  if (deferredInstall) {
    el.innerHTML = `<div class="panel install"><span><b>Put TimeKeeper on your home screen</b><br><span class="muted">It opens like an app.</span></span><button class="primary" id="inst-go">Install app</button></div>`;
    $('#inst-go').onclick = async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; el.hidden = true; };
  } else if (isIOS) {
    el.innerHTML = `<div class="panel"><b>Put TimeKeeper on your home screen</b><p class="note">In Safari, tap the Share button, then <b>Add to Home Screen</b>. Open it from the new icon from now on.</p></div>`;
  } else {
    el.innerHTML = `<div class="panel"><b>Put TimeKeeper on your home screen</b><p class="note">In Chrome, open the ⋮ menu and tap <b>Add to Home screen</b> or <b>Install app</b>.</p></div>`;
  }
  el.hidden = false;
}

/* ---------- boot ---------- */
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE')) {
  $('#app').innerHTML = `<div class="panel empty"><h2>Almost set up</h2><p class="note">Open <b>config.js</b> and paste in your Firebase settings. The README walks through it step by step.</p></div>`;
  throw new Error('VDI TimeKeeper: config.js not filled in');
}
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
setPersistence(auth, browserLocalPersistence).catch(() => {});

let uid = null, owner = false, view = 'me';
let me = null, meReady = false, meUnsub = null;
let staff = [], staffUnsub = null, weeks = {}, weekUnsubs = {}, weekSubKey = '';
let selWeek = wkKey(Date.now()), selId = null;
let ticker = null, secTicker = null;

onAuthStateChanged(auth, user => {
  cleanup();
  if (!user) { uid = null; return renderAuth(); }
  uid = user.uid; owner = uid === MANAGER_UID;
  $('#signout').hidden = false;
  $('#who-line').textContent = owner ? 'Manager view · only you can see hours' : `Signed in as ${user.email}`;
  meUnsub = onSnapshot(doc(db, 'staff', uid), s => {
    me = s.exists() ? { ...s.data({ serverTimestamps: 'estimate' }) } : null;
    if (me) me.sinceMs = ms(me.since);
    meReady = true;
    if (view === 'me') renderEmployee();
  }, e => console.warn(e));
  if (owner) {
    $('#tabs').hidden = false;
    view = isPhone ? 'me' : 'team';
    staffUnsub = onSnapshot(collection(db, 'staff'), s => {
      staff = s.docs.map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, sinceMs: ms(x.since) }; });
      subWeeks();
      if (view === 'team') renderTeam();
    }, e => console.warn(e));
  } else {
    view = 'me';
  }
  setView(view);
  ticker = setInterval(() => { if (view === 'team') renderTeam(true); else checkReminders(); }, 20000);
  secTicker = setInterval(() => { if (view === 'me') tickClock(); }, 1000);
});

function cleanup() {
  meUnsub?.(); staffUnsub?.(); Object.values(weekUnsubs).forEach(u => u()); weekUnsubs = {}; weekSubKey = '';
  clearInterval(ticker); clearInterval(secTicker);
  me = null; meReady = false; staff = []; weeks = {}; selId = null;
  $('#tabs').hidden = true; $('#signout').hidden = true;
}
$('#signout').onclick = () => signOut(auth);
$('#tab-team').onclick = () => setView('team');
$('#tab-me').onclick = () => setView('me');
function setView(v) {
  view = v; setViewAttr(v);
  $('#tab-team').setAttribute('aria-pressed', v === 'team');
  $('#tab-me').setAttribute('aria-pressed', v === 'me');
  renderInstall();
  v === 'team' ? renderTeam() : renderEmployee();
}

/* ---------- sign in ---------- */
function renderAuth() {
  setViewAttr('auth'); renderInstall();
  $('#who-line').textContent = 'Time clock';
  $('#app').innerHTML = `<div class="panel stack">
    <div><div class="eyebrow">Welcome</div><h2>Sign in to punch in and out</h2></div>
    <label class="field" for="em">Email<input type="email" id="em" autocomplete="email" inputmode="email"></label>
    <label class="field" for="pw">Password<input type="password" id="pw" autocomplete="current-password"></label>
    <p class="err" id="auth-err" hidden></p>
    <div class="actions row">
      <button class="primary" id="si">Sign in</button>
      <button id="su">Create account</button>
    </div>
    <button class="link" id="fp">Forgot password?</button>
    <p class="note">First time? Enter your email, pick a password of at least 6 characters, and tap Create account.</p>
  </div>`;
  const err = m => { const e = $('#auth-err'); e.textContent = m; e.hidden = !m; };
  const msg = e => ({
    'auth/invalid-credential': 'That email and password don\'t match. Try again or reset your password.',
    'auth/wrong-password': 'That password is wrong.',
    'auth/user-not-found': 'No account uses that email. Tap Create account.',
    'auth/email-already-in-use': 'That email already has an account. Tap Sign in.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/invalid-email': 'Enter a full email address.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/network-request-failed': "You're offline. Connect and try again."
  })[e?.code] || 'Sign-in failed. Try again.';
  const go = async fn => {
    const em = $('#em').value.trim(), pw = $('#pw').value;
    if (!em || !pw) return err('Enter your email and password.');
    err(''); document.querySelectorAll('#app button').forEach(b => b.disabled = true);
    try { await fn(auth, em, pw); } catch (e) { err(msg(e)); document.querySelectorAll('#app button').forEach(b => b.disabled = false); }
  };
  $('#si').onclick = () => go(signInWithEmailAndPassword);
  $('#su').onclick = () => go(createUserWithEmailAndPassword);
  $('#pw').onkeydown = e => { if (e.key === 'Enter') go(signInWithEmailAndPassword); };
  $('#fp').onclick = async () => {
    const em = $('#em').value.trim(); if (!em) return err('Enter your email first, then tap Forgot password.');
    try { await sendPasswordResetEmail(auth, em); err(''); toast('Reset link sent. Check your email.'); } catch (e) { err(msg(e)); }
  };
}

/* ---------- employee ---------- */
let firedBanner = null, audioCtx = null;
function renderEmployee() {
  const app = $('#app');
  if (!meReady) { app.innerHTML = `<div class="panel empty"><h2>Loading your time card…</h2></div>`; return; }
  if (!me) {
    app.innerHTML = `<div class="panel stack">
      <div><div class="eyebrow">First time here</div><h2>Set up your time card</h2></div>
      <label class="field" for="nm">Your name, as your manager knows you<input type="text" id="nm" autocomplete="name" placeholder="e.g. Jordan Reyes"></label>
      <button class="primary" id="mk">Create my time card</button>
      <p class="note">Your manager sees your clock-in and clock-out times. Nobody else can.</p></div>`;
    $('#mk').onclick = async () => {
      const n = $('#nm').value.trim(); if (!n) return toast('Enter your name first');
      $('#mk').disabled = true;
      try { await setDoc(doc(db, 'staff', uid), { name: n, onClock: false, since: null, remindIn: '09:00', remindOut: '17:00', days: [0,1,2,3,4], joined: serverTimestamp() }); }
      catch (e) { toast(failMsg(e)); $('#mk').disabled = false; }
    };
    return;
  }
  const on = !!me.onClock;
  const days = Array.isArray(me.days) ? me.days : [0,1,2,3,4];
  const notifState = ('Notification' in window) ? Notification.permission : 'unsupported';
  app.innerHTML = `<div class="stack">
    <div id="rem-banner"></div>
    <section class="panel clock">
      <div class="date" id="today"></div>
      <div class="now" id="now"></div>
      <span class="state ${on ? 'on' : 'off'}"><span class="dot"></span>${on ? `On the clock since ${esc(fT(me.sinceMs))}` : 'Off the clock'}</span>
      <button class="punch ${on ? 'out' : 'in'}" id="punch">${on ? 'Clock out' : 'Clock in'}</button>
      <div class="muted" style="font-size:.85rem">${esc(me.name)}</div>
    </section>
    <section class="panel stack">
      <div><div class="eyebrow">Reminders</div><h2>Remind me to punch</h2></div>
      <div class="row">
        <label class="field" for="r-in">Clock-in reminder<input type="time" id="r-in" value="${esc(me.remindIn || '09:00')}"></label>
        <label class="field" for="r-out">Clock-out reminder<input type="time" id="r-out" value="${esc(me.remindOut || '17:00')}"></label>
        <button class="primary" id="save-rem">Save reminders</button>
      </div>
      <div class="field" style="gap:6px">Work days<div class="days">${DAYS.map((d, i) => `<label class="${days.includes(i) ? 'on' : ''}"><input type="checkbox" id="day-${i}" value="${i}" ${days.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div></div>
      <div class="grid2" style="border-top:1px solid var(--line);padding-top:16px">
        <div class="stack" style="gap:8px"><b>Alerts from this app</b>
          <p class="note">A banner, a chime and a notification go off at your times while TimeKeeper is open or was opened recently.</p>
          ${notifState === 'default' ? `<button id="notif">Allow notifications</button>` : notifState === 'denied' ? `<p class="note">Notifications are blocked. Turn them on for TimeKeeper in your phone's Settings.</p>` : notifState === 'unsupported' ? `<p class="note">${isIOS ? 'On iPhone, notifications work after you add TimeKeeper to your Home Screen.' : 'This browser does not support notifications.'}</p>` : `<p class="note">Notifications are on.</p>`}
        </div>
        <div class="stack" style="gap:8px"><b>Reminders when the app is closed</b>
          <p class="note">Add both as repeating Google Calendar events, then set each event's alert to "At time of event".</p>
          <div class="links" id="gcal"></div></div>
      </div>
    </section></div>`;
  tickClock(); renderGcal(); checkReminders();
  $('#punch').onclick = punch;
  document.querySelectorAll('.days input').forEach(i => i.onchange = () => i.parentElement.classList.toggle('on', i.checked));
  const nb = $('#notif'); if (nb) nb.onclick = async () => { try { await Notification.requestPermission(); } catch {} renderEmployee(); };
  $('#save-rem').onclick = async () => {
    const d = [...document.querySelectorAll('.days input:checked')].map(x => +x.value);
    const ri = $('#r-in').value, ro = $('#r-out').value;
    if (!ri || !ro) return toast('Pick both reminder times');
    $('#save-rem').disabled = true; unlockAudio();
    try { await updateDoc(doc(db, 'staff', uid), { remindIn: ri, remindOut: ro, days: d }); toast('Reminders saved'); }
    catch (e) { toast(failMsg(e)); } finally { const b = $('#save-rem'); if (b) b.disabled = false; }
  };
}
function tickClock() { const n = $('#now'), t = $('#today'); if (!n) return; const d = new Date(); n.textContent = fT(d); t.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }); }
async function punch() {
  unlockAudio();
  const b = $('#punch'); b.disabled = true;
  try {
    if (!me.onClock) { await updateDoc(doc(db, 'staff', uid), { onClock: true, since: serverTimestamp() }); toast('Clocked in'); }
    else { await closeShift(uid, me.since, me.sinceMs); toast('Clocked out'); }
    clearBanner();
  } catch (e) { toast(failMsg(e)); b.disabled = false; }
}
// Closes an open shift: one server-stamped punch record plus the time card reset, saved together.
async function closeShift(id, sinceTs, sinceMs) {
  const batch = writeBatch(db);
  if (sinceTs) batch.set(doc(collection(db, 'staff', id, 'punches')), { in: sinceTs, out: serverTimestamp(), week: wkKey(sinceMs) });
  batch.update(doc(db, 'staff', id), { onClock: false, since: null });
  await batch.commit();
}
function renderGcal() {
  const el = $('#gcal'); if (!el || !me) return;
  const days = me.days || [];
  if (!days.length) { el.innerHTML = '<span class="note">Pick at least one work day.</span>'; return; }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const mk = (label, t) => {
    const [h, m] = t.split(':').map(Number); let s = new Date();
    for (let i = 0; i < 8; i++) { const c = new Date(); c.setDate(c.getDate() + i); if (days.includes(dowIdx(c))) { s = c; break; } }
    s.setHours(h, m, 0, 0); const e = new Date(s.getTime() + 5 * 60000);
    const f = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const q = new URLSearchParams({ action: 'TEMPLATE', text: label, dates: `${f(s)}/${f(e)}`, ctz: tz, recur: 'RRULE:FREQ=WEEKLY;BYDAY=' + days.map(i => RR[i]).join(','), details: 'Open VDI TimeKeeper and punch.' });
    return `https://calendar.google.com/calendar/render?${q}`;
  };
  el.innerHTML = `<a class="btn" target="_blank" rel="noopener" href="${esc(mk('Clock in', me.remindIn || '09:00'))}">Add clock-in reminder</a>
    <a class="btn" target="_blank" rel="noopener" href="${esc(mk('Clock out', me.remindOut || '17:00'))}">Add clock-out reminder</a>`;
}
function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch {} }
function chime() { try { if (!audioCtx) return; const t = audioCtx.currentTime; [880, 660].forEach((f, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(.0001, t + i*.25); g.gain.exponentialRampToValueAtTime(.25, t + i*.25 + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i*.25 + .4); o.start(t + i*.25); o.stop(t + i*.25 + .45); }); } catch {} }
const firedKey = k => `tk-fired-${k}-${new Date().toDateString()}`;
const wasFired = k => { try { return localStorage.getItem(firedKey(k)) === '1'; } catch { return false; } };
const markFired = k => { try { localStorage.setItem(firedKey(k), '1'); } catch {} };
function clearBanner() { firedBanner = null; const b = $('#rem-banner'); if (b) b.innerHTML = ''; }
async function notify(body) {
  try { if (Notification.permission !== 'granted') return; const reg = await navigator.serviceWorker.ready; reg.showNotification('VDI TimeKeeper', { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'tk-reminder' }); } catch {}
}
function checkReminders() {
  if (!me || !$('#rem-banner')) return;
  const now = new Date(); if (!(me.days || []).includes(dowIdx(now))) return;
  const mins = now.getHours() * 60 + now.getMinutes();
  const at = s => { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const ri = at(me.remindIn), ro = at(me.remindOut);
  let kind = null;
  if (!me.onClock && ri != null && mins >= ri && mins < ri + 90) kind = 'in';
  if (me.onClock && ro != null && mins >= ro && mins < ro + 90) kind = 'out';
  if (!kind) { if (firedBanner) clearBanner(); return; }
  if (firedBanner === kind) return;
  firedBanner = kind;
  const text = kind === 'in' ? `It's ${fmtRem(me.remindIn)}. Time to clock in.` : `It's ${fmtRem(me.remindOut)}. Remember to clock out.`;
  $('#rem-banner').innerHTML = `<div class="banner" role="alert"><span>${esc(text)}</span><button class="primary" id="ban-punch">${kind === 'in' ? 'Clock in now' : 'Clock out now'}</button></div>`;
  $('#ban-punch').onclick = punch;
  if (!wasFired(kind)) { markFired(kind); chime(); notify(text); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && view === 'me') { tickClock(); checkReminders(); } });

/* ---------- manager ---------- */
function subWeeks() {
  const key = selWeek + '|' + staff.map(s => s.id).sort().join(',');
  if (key === weekSubKey) return; weekSubKey = key;
  Object.values(weekUnsubs).forEach(u => u()); weekUnsubs = {}; weeks = {};
  staff.forEach(s => {
    weekUnsubs[s.id] = onSnapshot(query(collection(db, 'staff', s.id, 'punches'), where('week', '==', selWeek)), snap => {
      weeks[s.id] = snap.docs.map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { pid: d.id, in: ms(x.in), out: ms(x.out) }; });
      if (view === 'team') renderTeam();
    }, e => console.warn(e));
  });
}
function shiftsFor(s) {
  const list = [...(weeks[s.id] || [])];
  if (s.onClock && s.sinceMs && wkKey(s.sinceMs) === selWeek) list.push({ in: s.sinceMs, out: null, open: true });
  return list.sort((a, b) => a.in - b.in);
}
function dayTotals(list) { const t = [0,0,0,0,0,0,0]; list.forEach(x => { t[dowIdx(new Date(x.in))] += (x.out ?? Date.now()) - x.in; }); return t; }
function typical(list, f) {
  const byDay = {}; list.forEach(x => { const k = new Date(x.in).toDateString(); (byDay[k] = byDay[k] || []).push(x); });
  const v = Object.values(byDay).map(arr => f === 'in' ? Math.min(...arr.map(a => a.in)) : Math.max(...arr.filter(a => a.out).map(a => a.out)))
    .filter(Number.isFinite).map(t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); });
  return v.length ? minsToClock(v.reduce((a, b) => a + b, 0) / v.length) : '—';
}
function renderTeam(tickOnly) {
  if (!owner) return;
  const app = $('#app');
  if (tickOnly && $('#detail')?.contains(document.activeElement)) return;
  const wd = keyDate(selWeek), we = new Date(wd); we.setDate(we.getDate() + 6);
  const sorted = [...staff].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const rows = sorted.map(s => { const l = shiftsFor(s); const d = dayTotals(l); return { s, l, d, tot: d.reduce((a, b) => a + b, 0) }; });
  const teamTot = rows.reduce((a, r) => a + r.tot, 0);
  const onNow = staff.filter(s => s.onClock).length;
  const ot = rows.filter(r => r.tot > 40 * 36e5).length;
  const thisWeek = selWeek === wkKey(Date.now());

  if (!staff.length) {
    app.innerHTML = `${weekbarHtml(wd, we, thisWeek)}<div class="panel empty" style="margin-top:16px">
      <h2>No one has set up a time card yet</h2>
      <p class="note">Send your team this site's link. Each person creates an account, enters their name and sets their reminders, then shows up here.</p></div>`;
    bindWeekbar(); return;
  }
  app.innerHTML = `${weekbarHtml(wd, we, thisWeek)}
  <div class="kpis" style="margin:16px 0">
    <div class="kpi"><span class="eyebrow">On the clock now</span><b>${onNow}<span class="muted" style="font-size:1rem"> / ${staff.length}</span></b></div>
    <div class="kpi"><span class="eyebrow">Team hours this week</span><b>${fH(teamTot)}</b></div>
    <div class="kpi"><span class="eyebrow">Over 40 hours</span><b style="color:${ot ? 'var(--warn)' : 'inherit'}">${ot}</b></div>
    <div class="kpi"><span class="eyebrow">Employees</span><b>${staff.length}</b></div>
  </div>
  <div class="team-grid"><div class="tablewrap"><table>
    <thead><tr><th>Employee</th>${DAYS.map((d, i) => { const x = new Date(wd); x.setDate(x.getDate() + i); return `<th>${d} ${x.getDate()}</th>`; }).join('')}<th>Typical in</th><th>Total hrs</th></tr></thead>
    <tbody>${rows.map(r => `<tr data-id="${esc(r.s.id)}" aria-selected="${r.s.id === selId}" tabindex="0">
      <td><div style="font-weight:700">${esc(r.s.name || 'Employee')}</div>
        ${r.s.onClock ? `<span class="pill on"><span class="dot"></span>In since ${esc(fT(r.s.sinceMs))}</span>` : `<span class="pill off">Off</span>`}</td>
      ${r.d.map(v => `<td class="d ${v ? '' : 'z'}">${v ? fH(v) : '·'}</td>`).join('')}
      <td class="d">${esc(typical(r.l, 'in'))}</td>
      <td class="tot ${r.tot > 40 * 36e5 ? 'ot' : ''}">${fH(r.tot)}</td></tr>`).join('')}</tbody>
  </table></div>
  <div id="detail"></div></div>
  <p class="note" style="margin-top:10px">Shortcuts: <span class="kbd">←</span> <span class="kbd">→</span> change week · <span class="kbd">Tab</span> then <span class="kbd">Enter</span> opens an employee's punch log.</p>`;
  bindWeekbar();
  app.querySelectorAll('tbody tr').forEach(tr => { const go = () => { selId = selId === tr.dataset.id ? null : tr.dataset.id; renderTeam(); }; tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter') go(); }; });
  renderDetail(rows);
}
function weekbarHtml(wd, we, thisWeek) {
  return `<div class="weekbar">
    <div><div class="eyebrow">Week ${isoWeek(wd)}${thisWeek ? ' · this week' : ''}</div><h2>${wd.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</h2></div>
    <div class="nav"><button id="wk-prev">← Prev</button>${thisWeek ? '' : '<button id="wk-now">This week</button>'}<button id="wk-next" ${thisWeek ? 'disabled' : ''}>Next →</button><button id="csv">Export CSV</button></div></div>`;
}
function bindWeekbar() {
  const mv = n => { const d = keyDate(selWeek); d.setDate(d.getDate() + 7 * n); selWeek = wkKey(d); subWeeks(); renderTeam(); };
  $('#wk-prev').onclick = () => mv(-1); $('#wk-next').onclick = () => mv(1);
  const n = $('#wk-now'); if (n) n.onclick = () => { selWeek = wkKey(Date.now()); subWeeks(); renderTeam(); };
  $('#csv').onclick = exportCsv;
}
document.addEventListener('keydown', e => {
  if (view !== 'team' || e.ctrlKey || e.altKey || e.metaKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
  if (e.key === 'ArrowLeft') { $('#wk-prev')?.click(); e.preventDefault(); }
  if (e.key === 'ArrowRight') { const n = $('#wk-next'); if (n && !n.disabled) { n.click(); e.preventDefault(); } }
});
function renderDetail(rows) {
  const host = $('#detail'); if (!host) return;
  const r = rows.find(x => x.s.id === selId);
  if (!r) { host.innerHTML = `<p class="note">Select an employee to see each punch, fix a missed clock-out, or add a shift.</p>`; return; }
  const s = r.s, list = r.l;
  host.innerHTML = `<section class="panel stack">
    <div class="weekbar"><div><div class="eyebrow">Punch log</div><h2>${esc(s.name || 'Employee')}</h2></div>
      <div class="nav">${s.onClock ? `<button class="primary" id="force-out">Clock out now</button>` : ''}<button class="danger" id="rm">Remove</button></div></div>
    <div class="facts">
      <div><span class="eyebrow">Hours this week</span><b>${fH(r.tot)}</b></div>
      <div><span class="eyebrow">Shifts</span><b>${list.length}</b></div>
      <div><span class="eyebrow">Typical clock-in</span><b>${esc(typical(list, 'in'))}</b></div>
      <div><span class="eyebrow">Typical clock-out</span><b>${esc(typical(list, 'out'))}</b></div>
      <div><span class="eyebrow">Their reminders</span><b>${esc(fmtRem(s.remindIn))} / ${esc(fmtRem(s.remindOut))}</b><span class="muted" style="font-size:.8rem">${(s.days || []).map(i => DAYS[i]).join(' ') || 'No days set'}</span></div>
    </div>
    <div>${list.length ? list.map((x, i) => `<div class="shift">
        <div style="font-weight:600">${esc(fD(x.in))}</div>
        <div class="dur">${fH((x.out ?? Date.now()) - x.in)} h</div>
        <label class="field" for="in-${i}">In<input type="time" id="in-${i}" value="${hhmm(x.in)}" ${x.open ? 'disabled' : ''}></label>
        ${x.open ? `<span class="pill on"><span class="dot"></span>Still in</span>` : `<label class="field" for="out-${i}">Out<input type="time" id="out-${i}" value="${hhmm(x.out)}"></label>`}
        ${x.open ? '' : `<div class="acts"><button data-act="save" data-k="${i}">Save</button><button class="danger" data-act="del" data-k="${i}">Delete</button></div>`}
      </div>`).join('') : `<p class="note">No punches this week.</p>`}</div>
    <div class="stack" style="border-top:1px solid var(--line);padding-top:14px;gap:10px">
      <b>Add a missed shift</b>
      <div class="row">
        <label class="field" for="add-d">Date<input type="date" id="add-d" value="${selWeek}"></label>
        <label class="field" for="add-in">Clock in<input type="time" id="add-in" value="09:00"></label>
        <label class="field" for="add-out">Clock out<input type="time" id="add-out" value="17:00"></label>
        <button id="add-go">Add shift</button>
      </div></div>
  </section>`;
  host.querySelectorAll('button[data-act]').forEach(b => b.onclick = async () => {
    const x = list[+b.dataset.k], ref = doc(db, 'staff', s.id, 'punches', x.pid);
    b.disabled = true;
    try {
      if (b.dataset.act === 'del') {
        if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirm delete'; b.disabled = false; return; }
        await deleteDoc(ref); toast('Shift deleted');
      } else {
        const k = b.dataset.k, base = new Date(x.in);
        const [ih, im] = $(`#in-${k}`).value.split(':').map(Number), [oh, om] = $(`#out-${k}`).value.split(':').map(Number);
        const ni = new Date(base); ni.setHours(ih, im, 0, 0); const no = new Date(base); no.setHours(oh, om, 0, 0); if (no <= ni) no.setDate(no.getDate() + 1);
        await updateDoc(ref, { in: Timestamp.fromMillis(+ni), out: Timestamp.fromMillis(+no), week: wkKey(+ni) }); toast('Shift updated');
      }
    } catch (e) { toast(failMsg(e)); b.disabled = false; }
  });
  $('#add-go').onclick = async () => {
    const dv = $('#add-d').value, iv = $('#add-in').value, ov = $('#add-out').value;
    if (!dv || !iv || !ov) return toast('Fill in the date and both times');
    const [y, m, d] = dv.split('-').map(Number), [ih, im] = iv.split(':').map(Number), [oh, om] = ov.split(':').map(Number);
    const ni = new Date(y, m - 1, d, ih, im), no = new Date(y, m - 1, d, oh, om); if (no <= ni) no.setDate(no.getDate() + 1);
    $('#add-go').disabled = true;
    try {
      await addDoc(collection(db, 'staff', s.id, 'punches'), { in: Timestamp.fromMillis(+ni), out: Timestamp.fromMillis(+no), week: wkKey(+ni) });
      toast(wkKey(+ni) === selWeek ? 'Shift added' : 'Shift added to the week of ' + keyDate(wkKey(+ni)).toLocaleDateString([], { month: 'short', day: 'numeric' }));
    } catch (e) { toast(failMsg(e)); } finally { const b = $('#add-go'); if (b) b.disabled = false; }
  };
  const fo = $('#force-out'); if (fo) fo.onclick = async () => { fo.disabled = true; try { await closeShift(s.id, s.since, s.sinceMs); toast('Clocked out'); } catch (e) { toast(failMsg(e)); fo.disabled = false; } };
  $('#rm').onclick = async e => {
    const b = e.currentTarget; if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirm remove'; return; }
    try { await deleteDoc(doc(db, 'staff', s.id)); selId = null; toast('Removed from the list. Delete their account in Firebase to block sign-in.'); } catch (err) { toast(failMsg(err)); }
  };
}
function exportCsv() {
  const lines = [['Employee', 'Date', 'Clock in', 'Clock out', 'Hours']];
  [...staff].sort((a, b) => String(a.name).localeCompare(String(b.name))).forEach(s => shiftsFor(s).forEach(x =>
    lines.push([s.name || '', new Date(x.in).toLocaleDateString(), fT(x.in), x.out ? fT(x.out) : '(still in)', fH((x.out ?? Date.now()) - x.in)])));
  const csv = lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `timesheet-week-of-${selWeek}.csv` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
