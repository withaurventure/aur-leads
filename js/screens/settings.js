// Settings: pitch details per brand (services, contacts, sender), lock, account, about.
import { rpc, currentEmail } from '../api.js';
import { esc, icon, pageHeader, toast, confirmBox, loading } from '../ui.js';
import { pitchConfig, savePitchConfig } from '../brands.js';
import { runLock, bioAvailable, bioEnabled, enableBio, disableBio } from '../security/lock.js';
import { DESK_URL } from '../handoff.js';
import { pushState, enablePush, disablePush, sendTestAlert } from '../push.js';

export const APP_VERSION = '1.0';

export async function renderSettings(ctx, _p, view, alive) {
  view.innerHTML = pageHeader('Settings') + loading();
  const [cfg, canBio, bioOn] = await Promise.all([pitchConfig(true), bioAvailable(), bioEnabled()]);
  if (!alive()) return;

  const brandBlock = (key, title) => {
    const b = cfg[key];
    return `<section class="card">
      <h2>${esc(title)} pitch</h2>
      <label class="field">Name on the PDF<input data-k="${key}.name" value="${esc(b.name)}"></label>
      <label class="field">Tagline<input data-k="${key}.tagline" value="${esc(b.tagline)}" placeholder="Optional"></label>
      <label class="field">WhatsApp<input data-k="${key}.whatsapp" type="tel" inputmode="tel" value="${esc(b.whatsapp)}"></label>
      <label class="field">Email<input data-k="${key}.email" type="email" inputmode="email" value="${esc(b.email)}" placeholder="${key === 'printing' ? 'Add when the printing email is ready' : ''}"></label>
      <label class="field">Social handle<input data-k="${key}.handle" value="${esc(b.handle)}" placeholder="Optional, e.g. @withaurstudio"></label>
      <label class="field">Services <small class="muted">one per line: Title | short description</small>
        <textarea data-k="${key}.services" rows="6">${esc(b.services.join('\n'))}</textarea>
      </label>
    </section>`;
  };

  const ps = await pushState().catch(() => 'unsupported');
  if (!alive()) return;
  const pushText = { on: 'On for this phone. Replies, audit opens, WhatsApp follow-ups, good tenders, a 9 am summary and problems will reach you, even when the app is closed. Quiet from 10 pm to 7:30 am.',
    off: 'Get replies, audit opens, WhatsApp follow-ups, good tenders, a 9 am summary and problems as phone notifications, even when the app is closed.',
    blocked: 'Notifications are blocked for this site. In Chrome: tap the lock icon next to the address → Permissions → Notifications → Allow, then come back.',
    unsupported: 'This browser cannot show app notifications. Open AUR Leads in Chrome on Android and add it to the home screen.' }[ps];
  view.innerHTML = `
    ${pageHeader('Settings')}
    <section class="card">
      <h2>Phone alerts</h2>
      <p class="small">${esc(pushText)}</p>
      ${ps === 'on' ? `<div class="two"><button class="btn btn-outline" data-push-test>${icon('bell')}Send a test</button><button class="btn btn-ghost" data-push-off>Turn off</button></div>`
        : ps === 'off' ? `<button class="btn btn-primary btn-block" data-push-on>${icon('bell')}Turn on phone alerts</button>` : ''}
      <button class="list-btn" data-alerts-list>${icon('bell')}<span>See all alerts</span>${icon('right', 'chev')}</button>
    </section>
    <form id="pitch-form" novalidate>
      <section class="card">
        <h2>Pitch sender</h2>
        <label class="field">Your name on pitches<input data-k="sender" value="${esc(cfg.sender)}"></label>
      </section>
      ${brandBlock('studio', 'AUR Studio')}
      ${brandBlock('printing', 'AUR Printing Studio')}
      <button class="btn btn-primary btn-block" type="submit">Save pitch settings</button>
    </form>

    <section class="card">
      <h2>Privacy &amp; security</h2>
      <button class="list-btn" data-pin>${icon('lock')}<span>Change PIN</span>${icon('right', 'chev')}</button>
      ${canBio ? `<label class="switch-row">${icon('finger')}<span>Unlock with fingerprint</span><input type="checkbox" role="switch" data-bio ${bioOn ? 'checked' : ''}></label>` : ''}
      <p class="muted small">The app locks itself after 1 minute in the background.</p>
    </section>

    <section class="card">
      <h2>Agent</h2>
      <button class="list-btn" data-rescore>${icon('refresh')}<span>Re-score all leads now</span>${icon('right', 'chev')}</button>
      <a class="list-btn" href="https://supabase.com/dashboard/project/vtbosonrqfwhzlnjdrrh" target="_blank" rel="noopener">${icon('globe')}<span>Open Supabase dashboard</span>${icon('right', 'chev')}</a>
      <a class="list-btn" href="${DESK_URL}">${icon('desk')}<span>Open AUR Desk</span>${icon('right', 'chev')}</a>
    </section>

    <section class="card">
      <h2>Account</h2>
      <p class="small">Signed in as <strong>${esc(currentEmail())}</strong></p>
      <button class="btn btn-ghost btn-block danger-text" data-signout>${icon('out')}Sign out</button>
    </section>
    <p class="attribution">AUR Leads ${APP_VERSION} · an AUR Ventures tool<br>Map data © OpenStreetMap contributors · Powered by Geoapify</p>`;

  view.querySelector('#pitch-form').onsubmit = async (e) => {
    e.preventDefault();
    const next = structuredClone(cfg);
    view.querySelectorAll('[data-k]').forEach((el) => {
      const [a, b] = el.dataset.k.split('.');
      const v = el.value.trim();
      if (!b) next[a] = v;
      else next[a][b] = b === 'services' ? v.split('\n').map((s) => s.trim()).filter(Boolean) : v;
    });
    if (!next.studio.services.length || !next.printing.services.length) { toast('Keep at least one service for each brand'); return; }
    try { await savePitchConfig(next); toast('Pitch settings saved'); } catch (err) { toast(err.message); }
  };
  const on = view.querySelector('[data-push-on]');
  if (on) on.onclick = async () => {
    on.disabled = true; on.textContent = 'Turning on…';
    try { await enablePush(); await sendTestAlert(); toast('Alerts are on. A test is on its way.'); ctx.rerender(); }
    catch (e) { toast(e.message); on.disabled = false; on.textContent = 'Turn on phone alerts'; }
  };
  const off = view.querySelector('[data-push-off]');
  if (off) off.onclick = async () => { await disablePush(); toast('Phone alerts turned off'); ctx.rerender(); };
  const test = view.querySelector('[data-push-test]');
  if (test) test.onclick = async () => { try { await sendTestAlert(); toast('Test sent. It should arrive in a few seconds.'); } catch (e) { toast(e.message); } };
  view.querySelector('[data-alerts-list]').onclick = () => ctx.go('alerts');
  view.querySelector('[data-pin]').onclick = async () => { if (await runLock('change')) toast('PIN changed'); };
  const bio = view.querySelector('[data-bio]');
  if (bio) bio.onchange = async () => {
    try {
      if (bio.checked) { await enableBio(); toast('Fingerprint on'); } else { await disableBio(); toast('Fingerprint off'); }
    } catch { bio.checked = false; toast('Fingerprint could not be set up on this phone'); }
  };
  view.querySelector('[data-rescore]').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { const n = await rpc('rescore_all'); toast(`${Number(n).toLocaleString('en-IN')} leads re-scored`); }
    catch (err) { toast(err.message); } finally { b.disabled = false; }
  };
  view.querySelector('[data-signout]').onclick = async () => {
    const ok = await confirmBox({ title: 'Sign out?', text: 'Your leads stay safe in Supabase. You will need your Supabase password and a new PIN to sign in again.', ok: 'Sign out', danger: true });
    if (ok) await ctx.signOut();
  };
}
