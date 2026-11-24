// AUR Leads — app lock: a 4–8 digit PIN plus fingerprint. Same method as AUR Desk.
// • The PIN is never stored, only a salted, slow hash (PBKDF2-SHA-256, 150,000 rounds).
// • Fingerprint uses Android's own screen-lock check (WebAuthn); the fingerprint never reaches the app.
// • Forgot PIN: sign out and sign in again with your Supabase password. Leads are safe in Supabase.
import { store } from '../store.js';
import { esc, icon, LOGO, confirmBox } from '../ui.js';

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const MIN = 4, MAX = 8;

async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return b64(bits);
}
export const hasPin = async () => !!(await store.get('pin'));
async function setPin(pin) {
  const salt = rand(16);
  await store.set('pin', { salt: b64(salt), hash: await hashPin(pin, salt), length: pin.length });
}
async function checkPin(pin) {
  const p = await store.get('pin');
  return !!p && (await hashPin(pin, unb64(p.salt))) === p.hash;
}

/* ---------- fingerprint ---------- */
export async function bioAvailable() {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
  catch { return false; }
}
export const bioEnabled = async () => !!(await store.get('bio'));
export async function enableBio() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: 'AUR Leads' },
      user: { id: rand(16), name: 'aur-leads-owner', displayName: 'AUR Leads' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  await store.set('bio', { id: b64(cred.rawId) });
}
export const disableBio = () => store.del('bio');
async function bioUnlock() {
  const b = await store.get('bio');
  if (!b) return false;
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type: 'public-key', id: unb64(b.id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return true;
  } catch { return false; }
}

/* ---------- lock screen ----------
   'unlock': enter PIN or fingerprint · 'setup': create + confirm, offer fingerprint
   'change': current PIN, then create + confirm (can be cancelled)
   onForgot: called when the user chooses "Forgot PIN" and confirms */
export function runLock(mode = 'unlock', { onForgot } = {}) {
  const el = document.getElementById('lock');
  return new Promise(async (resolve) => {
    const saved = await store.get('pin');
    const useBio = await bioEnabled();
    let stage = mode === 'setup' ? 'create' : mode === 'change' ? 'verify' : 'unlock';
    let entry = '', first = '', fails = 0, blockedUntil = 0, busy = false;

    const done = (ok = true) => { el.hidden = true; el.innerHTML = ''; document.body.classList.remove('locked'); resolve(ok); };
    const fixedLen = () => ((stage === 'unlock' || stage === 'verify') ? (saved?.length || 4) : stage === 'confirm' ? first.length : 0);
    const titles = {
      unlock: ['Enter your PIN', useBio ? 'Or use your fingerprint' : ''],
      verify: ['Enter your current PIN', 'To change your PIN'],
      create: ['Create a PIN', '4 to 8 digits. Tap Done when finished'],
      confirm: ['Enter it again', 'Just to make sure'],
    };

    function draw(msg = '', bad = false) {
      const [t, sub] = titles[stage];
      const fixed = fixedLen();
      const count = fixed || Math.max(MIN, entry.length);
      const dots = Array.from({ length: fixed || MAX }, (_, i) =>
        `<span class="pin-dot${i < entry.length ? ' on' : ''}${!fixed && i >= count ? ' optional' : ''}"></span>`).join('');
      const left = stage === 'unlock' && useBio
        ? `<button class="key key-icon" data-bio aria-label="Unlock with fingerprint">${icon('finger')}</button>`
        : (!fixed ? `<button class="key key-text" data-done ${entry.length >= MIN ? '' : 'disabled'}>Done</button>` : '<span></span>');
      const foot = stage === 'unlock' ? '<button class="link-btn" data-forgot>Forgot PIN?</button>'
        : mode === 'change' ? '<button class="link-btn" data-cancel>Cancel</button>' : '';
      el.innerHTML = `
        <div class="lock-top">
          <div class="lock-mark">${LOGO(56)}</div>
          <h1 class="lock-title">${esc(t)}</h1>
          <p class="lock-sub">${esc(sub)}</p>
          <div class="pin-dots${bad ? ' shake' : ''}" aria-label="${entry.length} digits entered">${dots}</div>
          <p class="lock-msg" role="alert">${esc(msg)}</p>
        </div>
        <div class="keypad">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => `<button class="key" data-key="${k}">${k}</button>`).join('')}
          ${left}
          <button class="key" data-key="0">0</button>
          <button class="key key-icon" data-del aria-label="Delete last digit">${icon('del')}</button>
        </div>
        <div class="lock-foot">${foot}</div>`;
    }

    async function offerBio() {
      if (useBio || !(await bioAvailable())) return done();
      el.innerHTML = `
        <div class="lock-top">
          <div class="bio-badge">${icon('finger')}</div>
          <h1 class="lock-title">Unlock with fingerprint?</h1>
          <p class="lock-sub">Use your fingerprint instead of typing. Your PIN still works as a backup.</p>
        </div>
        <div class="lock-actions">
          <button class="btn btn-primary" data-bio-yes>Use fingerprint</button>
          <button class="btn btn-ghost on-dark" data-bio-no>Not now</button>
        </div>`;
    }

    async function submit() {
      if (busy) return;
      busy = true;
      try {
        if (stage === 'unlock' || stage === 'verify') {
          if (Date.now() < blockedUntil) { entry = ''; draw('Too many tries. Wait a few seconds.', true); return; }
          if (await checkPin(entry)) {
            entry = '';
            if (stage === 'unlock') return done();
            stage = 'create'; draw(); return;
          }
          fails += 1; entry = '';
          if (fails >= 5) { blockedUntil = Date.now() + 30000; fails = 0; draw('Too many tries. Wait 30 seconds.', true); }
          else draw('Wrong PIN', true);
        } else if (stage === 'create') {
          if (entry.length < MIN) { draw('Use at least 4 digits.', true); return; }
          first = entry; entry = ''; stage = 'confirm'; draw();
        } else if (stage === 'confirm') {
          if (entry === first) {
            await setPin(entry);
            entry = ''; first = '';
            return mode === 'change' ? done() : offerBio();
          }
          entry = ''; first = ''; stage = 'create'; draw("They didn't match. Try again.", true);
        }
      } finally { busy = false; }
    }

    el.onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b || busy) return;
      const fixed = fixedLen();
      if (b.dataset.key && entry.length < (fixed || MAX)) {
        entry += b.dataset.key; draw();
        if (fixed && entry.length === fixed) setTimeout(submit, 120);
      } else if ('del' in b.dataset) { entry = entry.slice(0, -1); draw(); }
      else if ('done' in b.dataset) submit();
      else if ('bio' in b.dataset) { if (await bioUnlock()) done(); }
      else if ('bioYes' in b.dataset) { try { await enableBio(); } catch { /* not set up on phone */ } done(); }
      else if ('bioNo' in b.dataset) done();
      else if ('cancel' in b.dataset) done(false);
      else if ('forgot' in b.dataset) {
        const ok = await confirmBox({
          title: 'Forgot your PIN?',
          text: 'You will be signed out. Sign in again with your Supabase email and password, then create a new PIN. Your leads are safe in Supabase.',
          ok: 'Sign out and reset', danger: true,
        });
        if (ok && onForgot) await onForgot();
      }
    };

    document.body.classList.add('locked');
    el.hidden = false;
    draw();
    if (stage === 'unlock' && useBio) setTimeout(async () => { if (await bioUnlock()) done(); }, 300);
  });
}
