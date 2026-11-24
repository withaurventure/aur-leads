// AUR Leads — small shared helpers: escaping, icons, dates, toasts, confirm box.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  tender: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  merge: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 6c4 0 6 2 6 6M9 18c4 0 6-2 6-6"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  whatsapp: '<path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.4-1.6-1-2-2l1-1-1-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  camera: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 18h4M12 18h8"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="18" r="2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  finger: '<path d="M12 11v3a8 8 0 0 1-1.5 4.6"/><path d="M8.5 8.5A4 4 0 0 1 16 11v2.5a12 12 0 0 1-.8 4.3"/><path d="M5.6 6.4A8 8 0 0 1 20 11v1.5"/><path d="M8 11v2a6 6 0 0 1-1.6 4.1"/><path d="M4 13.5V11c0-1 .2-2 .5-2.8"/>',
  del: '<path d="M21 4H8l-6 8 6 8h13a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"/><path d="M17 9l-5 6M12 9l5 6"/>',
  out: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-2"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  desk: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export const LOGO = (size = 40) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="AUR Leads"><rect width="64" height="64" rx="16" fill="#0B5D4B"/><path d="M17 21A26 26 0 0 1 43 47" stroke="#fff" stroke-opacity=".45" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M17 31A16 16 0 0 1 33 47" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="18" cy="46" r="6" fill="#F2A33A"/></svg>`;

/* ---------- formatting ---------- */
export const num = (n) => Number(n || 0).toLocaleString('en-IN');
export function timeAgo(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
}
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
export const inrShort = (n) => {
  if (n == null) return '—';
  const v = Number(n);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)} L`;
  return '₹' + Math.round(v).toLocaleString('en-IN');
};
export const dateInput = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '');
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const digits = (s) => String(s || '').replace(/\D/g, '');

/* ---------- small pieces used on many screens ---------- */
export function scoreChip(n, big = false) {
  const s = Number(n) || 0;
  const cls = s >= 8 ? 'hot' : s >= 5 ? 'warm' : 'cool';
  return `<span class="score ${cls}${big ? ' big' : ''}" aria-label="Score ${s} out of 10">${s || '–'}</span>`;
}
export const BRAND_LABEL = { studio: 'AUR Studio', printing: 'AUR Printing' };
export function brandTags(brand, short = false) {
  const t = (b) => `<span class="tag tag-${b}">${short ? (b === 'studio' ? 'Studio' : 'Printing') : BRAND_LABEL[b]}</span>`;
  if (brand === 'both') return t('studio') + t('printing');
  return brand ? t(brand) : '';
}
export const STATUS = {
  new: 'New', contacted: 'Contacted', replied: 'Replied', meeting: 'Meeting',
  proposal_sent: 'Proposal sent', won: 'Won', lost: 'Lost', do_not_contact: 'Do not contact',
};
export const statusTag = (s) => (s && s !== 'new' ? `<span class="tag tag-plain">${esc(STATUS[s] || s)}</span>` : '');

export function pageHeader(title, { back = true, sub = '', action = '' } = {}) {
  return `<header class="page-head">
    ${back ? `<button class="icon-btn" data-back aria-label="Back">${icon('back')}</button>` : ''}
    <div class="page-head-text"><h1>${esc(title)}</h1>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
    ${action}
  </header>`;
}

export const loading = (text = 'Loading…') => `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>${esc(text)}</div>`;
export const emptyBox = (text) => `<div class="empty">${esc(text)}</div>`;
export function errorBox(err) {
  const offline = !navigator.onLine;
  const msg = offline ? 'No internet. Connect and try again.' : (err && err.message) || 'Something went wrong.';
  return `<div class="error-box" role="alert"><p>${esc(msg)}</p><button class="btn btn-ghost" data-retry>${icon('refresh')}Try again</button></div>`;
}

/* ---------- toast ---------- */
let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- confirm box ---------- */
export function confirmBox({ title, text = '', ok = 'OK', cancel = 'Cancel', danger = false }) {
  const d = document.getElementById('confirm');
  d.innerHTML = `
    <div class="sheet-handle" aria-hidden="true"></div>
    <h2 class="sheet-title">${esc(title)}</h2>
    ${text ? `<p class="sheet-text">${esc(text)}</p>` : ''}
    <div class="sheet-actions">
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button>
      <button class="btn btn-ghost" data-no>${esc(cancel)}</button>
    </div>`;
  return new Promise((resolve) => {
    const finish = (v) => { d.close(); resolve(v); };
    d.querySelector('[data-ok]').onclick = () => finish(true);
    d.querySelector('[data-no]').onclick = () => finish(false);
    d.oncancel = (e) => { e.preventDefault(); finish(false); };
    d.showModal();
  });
}
