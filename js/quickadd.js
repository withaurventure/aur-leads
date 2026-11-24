// "Add lead": save a business you found yourself (on X, Telegram, LinkedIn, Instagram or offline).
// The database checks every contact you enter, so a business already saved is opened, not added twice.
import { rpc } from './api.js';
import { esc, toast } from './ui.js';

const TYPES = [
  ['web3', 'Web3 project or company · AUR Studio'],
  ['medical', 'Hospital or clinic · AUR Studio'],
  ['bulk_buyer', 'Bulk printing buyer · AUR Printing Studio'],
  ['election', 'Election / party office · AUR Printing Studio'],
  ['printing_vendor', 'Printing vendor (prints for you)'],
];

// pasted links → plain handles; anything else is sent as typed
export const cleanX = (v) => (v || '').trim().replace(/^(https?:\/\/)?(www\.|mobile\.)?(twitter|x)\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
export const cleanTelegram = (v) => (v || '').trim().replace(/^(https?:\/\/)?(www\.)?(t|telegram)\.me\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
export const cleanInstagram = (v) => (v || '').trim().replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();

export function openQuickAdd(ctx, segment = 'web3') {
  const d = document.getElementById('confirm');
  const f = (id, label, type = 'text', mode = 'text', ph = '') => `
    <label class="field">${esc(label)}<input id="q-${id}" type="${type}" inputmode="${mode}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
  d.innerHTML = `
    <div class="sheet-handle" aria-hidden="true"></div>
    <h2 class="sheet-title">Add lead</h2>
    <p class="sheet-text">Add at least one contact. If this business is already saved, it opens instead.</p>
    <form id="qa-form" class="sheet-form" novalidate>
      <label class="field">Name<input id="q-name" type="text" autofocus required autocomplete="off" placeholder="e.g. Kalp Labs"></label>
      <label class="field">Type
        <select id="q-segment">${TYPES.map(([v, l]) => `<option value="${v}" ${v === segment ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      </label>
      ${f('x', 'X (Twitter)', 'text', 'text', '@handle or link')}
      ${f('telegram', 'Telegram', 'text', 'text', '@group or t.me link')}
      ${f('website', 'Website', 'url', 'url', 'example.com')}
      ${f('linkedin', 'LinkedIn page', 'url', 'url', 'linkedin.com/company/…')}
      ${f('email', 'Email', 'email', 'email')}
      ${f('phone', 'Phone / WhatsApp', 'tel', 'tel')}
      ${f('instagram', 'Instagram', 'text', 'text', '@username')}
      ${f('city', 'City', 'text', 'text', 'Optional')}
      <label class="field">Note<textarea id="q-note" rows="2" placeholder="Where you saw them, who to talk to"></textarea></label>
      <p class="form-error" id="q-error" role="alert"></p>
      <div class="sheet-actions">
        <button class="btn btn-primary" type="submit">Save lead</button>
        <button class="btn btn-ghost" type="button" data-no>Cancel</button>
      </div>
    </form>`;
  d.querySelector('[data-no]').onclick = () => d.close();
  const form = d.querySelector('#qa-form');
  const err = d.querySelector('#q-error');
  form.oninput = () => { err.textContent = ''; };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const v = (k) => d.querySelector(`#q-${k}`).value.trim();
    if (!v('name')) { err.textContent = 'Add a name.'; d.querySelector('#q-name').focus(); return; }
    const p = {
      name: v('name'), segment: v('segment'), x_handle: cleanX(v('x')), telegram: cleanTelegram(v('telegram')),
      website: v('website'), linkedin: v('linkedin'), email: v('email').toLowerCase(), phone: v('phone'),
      instagram: cleanInstagram(v('instagram')), city: v('city'), note: v('note'),
    };
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Saving…'; err.textContent = '';
    try {
      const r = await rpc('quick_add_lead', { p });
      d.close();
      toast(r.action === 'inserted' ? 'Lead added' : 'Already saved. Opening it');
      ctx.go('lead', { id: r.lead_id });
    } catch (ex) {
      err.textContent = (ex.message || 'Could not save').replace(/^.*?: /, '');
      btn.disabled = false; btn.textContent = 'Save lead';
    }
  };
  d.showModal();
}
