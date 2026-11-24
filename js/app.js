// AUR Leads — start-up, sign-in, lock, navigation.
import { loadSession, signIn, signOut, AuthError, currentEmail } from './api.js';
import { store } from './store.js';
import { esc, icon, LOGO, toast, errorBox } from './ui.js';
import { runLock, hasPin } from './security/lock.js';
import { renderHome } from './screens/home.js';
import { renderLeads } from './screens/leads.js';
import { renderLead } from './screens/lead.js';
import { renderPitch } from './screens/pitch.js';
import { renderTenders } from './screens/tenders.js';
import { renderReview, renderMerged, renderExcluded } from './screens/review.js';
import { renderSettings } from './screens/settings.js';

const SCREENS = {
  home: renderHome, leads: renderLeads, lead: renderLead, pitch: renderPitch,
  tenders: renderTenders, review: renderReview, merged: renderMerged, excluded: renderExcluded, settings: renderSettings,
};
const TABS = ['home', 'leads', 'tenders', 'review'];
const AUTO_LOCK_MS = 5 * 60 * 1000;   // locks after 5 minutes in the background
const UNLOCK_KEY = 'aur-leads-unlocked';
const markUnlocked = () => { try { sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); } catch { /* ignore */ } };
const recentlyUnlocked = () => { try { return Date.now() - Number(sessionStorage.getItem(UNLOCK_KEY) || 0) < AUTO_LOCK_MS; } catch { return false; } };

const view = document.getElementById('view');
let stack = [{ screen: 'home', params: {} }];
let renderId = 0;

// App-wide state shared by screens (filters survive moving between screens)
const state = {
  brand: 'all',                         // Home switch: all | studio | printing
  leadFilters: { minScore: 0, city: '', hasPhone: false, brand: '', status: '', due: false, q: '', sort: 'local' },
  tenderTab: 'open',
};

const ctx = {
  state, view,
  go(screen, params = {}) {
    stack.push({ screen, params });
    history.pushState({ depth: stack.length }, '');
    render();
  },
  replace(screen, params = {}) { stack[stack.length - 1] = { screen, params }; render(); },
  back() { if (stack.length > 1) history.back(); else ctx.tab('home'); },
  tab(name) {
    stack = [{ screen: name, params: {} }];
    history.replaceState({ depth: 1 }, '');
    render();
  },
  rerender: () => render(),
  current: () => stack[stack.length - 1],
  async signOut() {
    await signOut();
    await store.del('pin'); await store.del('bio');
    location.reload();
  },
};

window.addEventListener('popstate', () => {
  if (document.body.classList.contains('locked')) return;
  if (stack.length > 1) { stack.pop(); render(); }
});

async function render() {
  const id = ++renderId;
  const { screen, params } = stack[stack.length - 1];
  const tab = TABS.includes(screen) ? screen : ({ lead: 'leads', pitch: 'leads', merged: 'review', excluded: 'review', settings: 'home' }[screen] || 'home');
  document.querySelectorAll('.tab').forEach((t) => (t.dataset.tab === tab ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current')));
  view.scrollTop = 0;
  try {
    await SCREENS[screen](ctx, params, view, () => id === renderId);
  } catch (e) {
    if (e instanceof AuthError) return showLogin(e.message);
    if (id !== renderId) return;
    view.innerHTML = errorBox(e);
    const r = view.querySelector('[data-retry]'); if (r) r.onclick = render;
  }
  view.querySelectorAll('[data-back]').forEach((b) => { if (!b.onclick) b.onclick = () => ctx.back(); });
}

document.querySelector('.tabbar').addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (t) ctx.tab(t.dataset.tab);
});

/* ---------- sign-in ---------- */
function showLogin(message = '') {
  const el = document.getElementById('login');
  document.body.classList.add('locked');
  el.hidden = false;
  el.innerHTML = `
    <div class="lock-top">
      <div class="lock-mark">${LOGO(64)}</div>
      <h1 class="lock-title">AUR Leads</h1>
      <p class="lock-sub">Sign in with your Supabase account</p>
    </div>
    <form class="login-form" id="login-form" novalidate>
      <label for="l-email">Email</label>
      <input id="l-email" type="email" inputmode="email" autocomplete="username" value="${esc(currentEmail() || 'withaurventure@gmail.com')}" required>
      <label for="l-pass">Password</label>
      <input id="l-pass" type="password" autocomplete="current-password" required>
      <p class="lock-msg" role="alert">${esc(message)}</p>
      <button class="btn btn-primary btn-block" type="submit">Sign in</button>
    </form>`;
  const form = el.querySelector('#login-form');
  setTimeout(() => el.querySelector('#l-pass').focus(), 60);
  return new Promise((resolve) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      const msg = form.querySelector('.lock-msg');
      btn.disabled = true; btn.textContent = 'Signing in…'; msg.textContent = '';
      try {
        await signIn(form.querySelector('#l-email').value, form.querySelector('#l-pass').value);
        el.hidden = true; el.innerHTML = '';
        if (!(await hasPin())) await runLock('setup');
        markUnlocked();
        document.body.classList.remove('locked');
        resolve();
        render();
      } catch (err) {
        msg.textContent = navigator.onLine ? err.message : 'No internet. Connect and try again.';
        btn.disabled = false; btn.textContent = 'Sign in';
      }
    };
  });
}

/* ---------- auto-lock when the app is in the background ---------- */
// A refresh (or coming back within 5 minutes) does not ask for the PIN again.
let hiddenAt = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { hiddenAt = Date.now(); if (!document.body.classList.contains('locked')) markUnlocked(); return; }
  if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS && (await hasPin()) && !document.body.classList.contains('locked')) {
    await runLock('unlock', { onForgot: ctx.signOut });
  }
  markUnlocked();
  hiddenAt = 0;
});
setInterval(() => { if (!document.hidden && !document.body.classList.contains('locked')) markUnlocked(); }, 30000);
window.addEventListener('pagehide', () => { if (!document.body.classList.contains('locked')) markUnlocked(); });

/* ---------- start ---------- */
async function start() {
  const launch = document.getElementById('launch');
  setTimeout(() => launch.classList.add('gone'), 500);
  setTimeout(() => launch.remove(), 1100);
  history.replaceState({ depth: 1 }, '');
  const session = await loadSession();
  if (!session) { await showLogin(); return; }
  if (!(await hasPin())) await runLock('setup');
  else if (!recentlyUnlocked()) await runLock('unlock', { onForgot: ctx.signOut });
  markUnlocked();
  render();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}));
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; toast('AUR Leads updated'); }
  });
}

start();
export { ctx, icon };
