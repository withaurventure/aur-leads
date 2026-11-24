// AUR Leads — talking to Supabase (sign-in and data), with plain fetch: no extra libraries.
// The publishable key is safe to ship: every table only opens to your signed-in account.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY as KEY } from './config.js';
import { store } from './store.js';

export class AuthError extends Error {}
let session = null;      // { access_token, refresh_token, expires_at, email }
let refreshing = null;

export async function loadSession() {
  session = (await store.get('session')) || null;
  return session;
}
export const currentEmail = () => session?.email || '';

async function saveSession(data) {
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    email: data.user?.email || session?.email || '',
  };
  await store.set('session', session);
}

async function auth(path, body) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = data.error_code || data.error || '';
    const msg = data.msg || data.error_description || data.message || `Sign-in failed (${r.status})`;
    const e = new Error(/invalid/i.test(code + msg) ? 'Email or password is not right.' : msg);
    e.status = r.status;
    throw e;
  }
  return data;
}

export async function signIn(email, password) {
  const data = await auth('token?grant_type=password', { email: email.trim(), password });
  await saveSession(data);
}

async function refresh() {
  if (!session?.refresh_token) throw new AuthError('Please sign in again.');
  if (!refreshing) {
    refreshing = auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
      .then(saveSession)
      .catch(async (e) => {
        if (e.status === 400 || e.status === 401) { session = null; await store.del('session'); throw new AuthError('Please sign in again.'); }
        throw e;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function token() {
  if (!session) throw new AuthError('Please sign in.');
  if (session.expires_at - 90 < Date.now() / 1000) await refresh();
  return session.access_token;
}

export async function signOut() {
  try {
    if (session) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${session.access_token}` } });
  } catch { /* offline is fine */ }
  session = null;
  await store.del('session');
}

/* ---------- data ---------- */
// rest('v_leads?select=*&id=eq.x') → rows. Options: method, body, count (returns {rows,total}), prefer.
export async function rest(path, { method = 'GET', body, count = false, prefer = '' } = {}, retried = false) {
  const headers = { apikey: KEY, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' };
  const p = [];
  if (count) p.push('count=exact');
  if (prefer) p.push(prefer);
  if (method !== 'GET' && !prefer) p.push('return=minimal');
  if (p.length) headers.Prefer = p.join(',');
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error(navigator.onLine ? 'Could not reach the server. Try again.' : 'No internet. Connect and try again.');
  }
  if (r.status === 401 && !retried) { await refresh(); return rest(path, { method, body, count, prefer }, true); }
  const text = await r.text();
  if (!r.ok) {
    let msg = text;
    try { const j = JSON.parse(text); msg = j.message || j.hint || text; } catch { /* plain text */ }
    if (r.status === 401) throw new AuthError('Please sign in again.');
    throw new Error(`Server said: ${String(msg).slice(0, 160)}`);
  }
  const data = text ? JSON.parse(text) : null;
  if (count) {
    const total = Number((r.headers.get('content-range') || '').split('/')[1]) || 0;
    return { rows: data || [], total };
  }
  return data;
}

export const rpc = (fn, args = {}) => rest(`rpc/${fn}`, { method: 'POST', body: args, prefer: 'return=representation' });

// Value for a filter inside and=(...) / or=(...): quoted so commas and brackets in a search are safe.
export const q = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
export const enc = encodeURIComponent;
