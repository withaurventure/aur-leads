// Lead detail: why it scored, contacts (one tap), status, follow-up, notes, timeline,
// Create pitch, Won → AUR Desk, Do not contact.
import { rest, enc } from '../api.js';
import { esc, icon, scoreChip, brandTags, STATUS, pageHeader, toast, confirmBox, timeAgo, fmtDate, dateInput, loading } from '../ui.js';
import { telLink, waLink, mailLink, webLink, noteContact, setStatus, updateLead, logEvent } from '../leadactions.js';
import { sendToDesk, DESK_URL } from '../handoff.js';
import { cleanX, cleanTelegram } from '../quickadd.js';

const EVENT_LABEL = { found: 'Found', contacts_found: 'Contacts found', new_instagram: 'Instagram found', new_website: 'Website found',
  website_down: 'Website down', rating_changed: 'Rating changed', reviews_up: 'More reviews', status_changed: 'Map listing changed',
  merged: 'Merged duplicate', unmerged: 'Merge undone', pitch_sent: 'Pitch sent', hiring: 'Hiring', you: 'You' };
const MARKETING_ROLE = /marketing|community|social media|content|growth|brand|\bkol\b|ambassador|\bpr\b|public relations|communications|creative|graphic design|visual design|video editor|influencer|go-to-market|\bgtm\b/i;

export async function renderLead(ctx, { id }, view, alive) {
  view.innerHTML = pageHeader('Lead') + loading();
  const [rows, events] = await Promise.all([
    rest(`v_leads?id=eq.${enc(id)}&select=*`),
    rest(`lead_events?lead_id=eq.${enc(id)}&select=type,detail,created_at&order=created_at.desc&limit=40`),
  ]);
  if (!alive()) return;
  const l = rows[0];
  if (!l) { view.innerHTML = pageHeader('Lead') + '<div class="empty">This lead no longer exists. It may have been merged into another one.</div>'; return; }

  const reasons = (l.score_reason || '').split(', ').filter(Boolean);
  const maps = l.google_maps_url || (l.lat && l.lng ? `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}` : '');
  const contactRow = (ic, label, value, href, action, how, external = true) => `
    <div class="contact-row">
      <span class="contact-ic">${icon(ic)}</span>
      <span class="contact-text"><small>${esc(label)}</small><strong>${value ? esc(value) : '<span class="muted">Not found yet</span>'}</strong></span>
      ${href ? `<a class="btn btn-small" href="${esc(href)}" ${external ? 'target="_blank" rel="noopener"' : ''} ${how ? `data-how="${esc(how)}"` : ''}>${esc(action)}</a>` : ''}
    </div>`;

  const statusChips = Object.entries(STATUS).filter(([k]) => k !== 'do_not_contact')
    .map(([k, v]) => `<button class="chip" aria-pressed="${l.status === k}" data-status="${k}">${esc(v)}</button>`).join('');

  view.innerHTML = `
    ${pageHeader('Lead', { action: `<button class="icon-btn" data-edit aria-label="Edit contacts">${icon('edit')}</button>` })}
    <div class="lead-head">
      ${scoreChip(l.score, true)}
      <div>
        <h1>${esc(l.name)}</h1>
        <p class="muted">${icon('pin', 'inline')}${esc([l.category, l.address || l.city].filter(Boolean).join(' · '))}</p>
        <div class="tags">${brandTags(l.brand)}${l.status === 'do_not_contact' ? '<span class="tag tag-danger">Do not contact</span>' : ''}</div>
      </div>
    </div>

    ${reasons.length ? `<section class="card">
      <h2>Why ${l.score ?? '–'}/10</h2>
      <ul class="checks">${reasons.map((r) => `<li>${icon('check')}<span>${esc(r)}</span></li>`).join('')}</ul>
    </section>` : ''}

    ${hiringCard(l)}

    <section class="card contacts">
      ${contactRow('phone', 'Phone', l.phone, telLink(l), 'Call', 'Called', false)}
      ${contactRow('whatsapp', 'WhatsApp', l.whatsapp || l.phone, waLink(l), 'Chat', 'WhatsApp chat opened')}
      ${contactRow('mail', 'Email', l.email, mailLink(l), 'Mail', 'Email opened', false)}
      ${contactRow('globe', 'Website', l.website ? `${l.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}${l.website_ok === false ? ' (not working)' : ''}` : '', webLink(l.website), 'Open')}
      ${contactRow('camera', 'Instagram', l.instagram ? '@' + l.instagram : '', l.instagram ? `https://instagram.com/${l.instagram}` : '', 'View')}
      ${l.segment === 'web3' || l.x_handle ? contactRow('x', 'X (Twitter)', l.x_handle ? '@' + l.x_handle : '', l.x_handle ? `https://x.com/${l.x_handle}` : '', 'Open', 'X opened') : ''}
      ${l.segment === 'web3' || l.telegram ? contactRow('telegram', 'Telegram', l.telegram ? '@' + l.telegram : '', l.telegram ? `https://t.me/${l.telegram}` : '', 'Message', 'Telegram opened') : ''}
      ${l.linkedin ? contactRow('linkedin', 'LinkedIn', l.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\//, '').replace(/\/$/, ''), /^https?:/.test(l.linkedin) ? l.linkedin : 'https://' + l.linkedin, 'View', 'LinkedIn opened') : ''}
      ${l.facebook ? contactRow('facebook', 'Facebook', l.facebook.replace(/^https?:\/\/(www\.)?/, ''), l.facebook, 'View') : ''}
      ${maps ? contactRow('pin', 'Map', l.city || 'Location', maps, 'Map') : ''}
    </section>

    <section class="card">
      <h2>Status</h2>
      <div class="chips wrap">${statusChips}</div>
      <label class="field-row">${icon('clock', 'inline')}<span>Follow up on</span>
        <input type="date" id="followup" value="${dateInput(l.next_followup_at)}">
      </label>
      <label class="field">Notes
        <textarea id="notes" rows="3" placeholder="e.g. Spoke to the admin, call back after 4 pm">${esc(l.notes || '')}</textarea>
      </label>
    </section>

    <section class="card">
      <h2>Timeline</h2>
      ${events.length ? `<ul class="timeline">${events.map((e) => `
        <li><span class="dot" aria-hidden="true"></span><div><small>${esc(EVENT_LABEL[e.type] || e.type)} · ${esc(timeAgo(e.created_at))}</small><p>${esc(e.detail || '')}</p></div></li>`).join('')}</ul>`
        : '<p class="muted">Nothing yet.</p>'}
      <p class="muted small">First found ${esc(fmtDate(l.first_seen_at))}${l.source ? ` via ${esc(l.source)}` : ''}</p>
    </section>

    <button class="btn btn-ghost btn-block" data-govt>${icon('ban')}Government body: hide this lead</button>
    <button class="btn btn-ghost btn-block danger-text mt" data-dnc>${icon('ban')}${l.status === 'do_not_contact' ? 'Allow contact again' : 'Do not contact'}</button>

    <div class="action-bar">
      <button class="btn btn-primary" data-pitch ${l.status === 'do_not_contact' ? 'disabled' : ''}>${icon('file')}Create pitch</button>
      <button class="btn btn-outline" data-won>${l.status === 'won' ? 'Open AUR Desk' : 'Won → AUR Desk'}${icon('arrow')}</button>
    </div>`;

  // contact taps: note them (new → contacted, follow-up in 3 days)
  view.querySelectorAll('[data-how]').forEach((a) => a.addEventListener('click', () => noteContact(l, a.dataset.how)));

  view.querySelectorAll('[data-status]').forEach((b) => {
    b.onclick = async () => {
      try { await setStatus(l, b.dataset.status); toast(`Marked ${STATUS[b.dataset.status]}`); ctx.rerender(); }
      catch (e) { toast(e.message); }
    };
  });
  view.querySelector('#followup').onchange = async (e) => {
    const v = e.target.value;
    try {
      await updateLead(l, { next_followup_at: v ? new Date(v + 'T10:00:00+05:30').toISOString() : null }, v ? `Follow-up set for ${fmtDate(v)}` : 'Follow-up cleared');
      toast(v ? 'Follow-up saved' : 'Follow-up cleared');
    } catch (err) { toast(err.message); }
  };
  const notes = view.querySelector('#notes');
  notes.onchange = async () => {
    try { await updateLead(l, { notes: notes.value.trim() || null }); toast('Notes saved'); } catch (err) { toast(err.message); }
  };

  view.querySelector('[data-edit]').onclick = () => editContacts(ctx, l);
  view.querySelector('[data-pitch]').onclick = () => ctx.go('pitch', { id: l.id });
  view.querySelector('[data-dnc]').onclick = async () => {
    const off = l.status === 'do_not_contact';
    const ok = await confirmBox(off
      ? { title: 'Allow contact again?', text: 'The lead goes back to New and gets a fresh score.', ok: 'Allow' }
      : { title: 'Do not contact?', text: 'The lead stays saved (so it is never collected again as new) but drops out of your lists and pitches.', ok: 'Do not contact', danger: true });
    if (!ok) return;
    try { await updateLead(l, { status: off ? 'new' : 'do_not_contact' }, off ? 'Allowed contact again' : 'Marked do not contact'); ctx.rerender(); }
    catch (e) { toast(e.message); }
  };
  view.querySelector('[data-won]').onclick = () => won(ctx, l);
  view.querySelector('[data-govt]').onclick = async () => {
    const ok = await confirmBox({ title: 'Hide as a government body?', text: 'Orders from government bodies come through GeM tenders, so this lead leaves your lists. You can bring it back from Review → Hidden as government.', ok: 'Hide it' });
    if (!ok) return;
    try { await updateLead(l, { excluded: 'government (marked by you)', is_hidden: true }, 'Hidden as a government body'); toast('Hidden'); ctx.back(); }
    catch (e) { toast(e.message); }
  };
}

/* ---------- jobs the company posted (Web3) ---------- */
function hiringCard(l) {
  const jobs = l.meta?.hiring?.jobs || [];
  if (!jobs.length) return '';
  return `<section class="card">
    <h2>Hiring now</h2>
    <p class="muted small">Jobs posted in the last 60 days. A marketing or community role means they need that work done now.</p>
    <ul class="jobs">${jobs.map((j) => `
      <li><span class="job-main">
          <strong>${esc(j.title || 'Job')}</strong>
          <span class="muted small">${esc([j.location, j.posted_at ? timeAgo(j.posted_at) : ''].filter(Boolean).join(' · '))}</span>
          ${MARKETING_ROLE.test(j.title || '') ? '<span class="tags"><span class="tag job-hot">Marketing role</span></span>' : ''}
        </span>
        ${j.url ? `<a class="btn btn-small" href="${esc(j.url)}" target="_blank" rel="noopener">View job</a>` : ''}
      </li>`).join('')}</ul>
    <p class="muted small">Jobs from web3.career</p>
  </section>`;
}

/* ---------- Won → AUR Desk ---------- */
async function won(ctx, l) {
  if (l.status === 'won' && l.meta?.desk_client) { location.href = DESK_URL; return; }
  const brand = l.brand === 'both' ? await chooseBrand(l) : (l.brand === 'printing' ? 'printing' : 'studio');
  if (!brand) return;
  const name = brand === 'printing' ? 'AUR Printing Studio' : 'AUR Studio';
  const res = await sendToDesk(l, brand);
  if (!res.ok && res.reason === 'no-desk') {
    const ok = await confirmBox({ title: 'AUR Desk not found on this phone', text: 'Open AUR Desk once on this phone (in Chrome), then try again. The lead will still be marked as Won now.', ok: 'Mark as Won' });
    if (!ok) return;
  }
  try {
    await updateLead(l, { status: 'won', meta: { ...(l.meta || {}), desk_client: res.ok ? res.id : null, desk_brand: brand } });
    await logEvent(l.id, 'you', res.ok ? `Won. Added to AUR Desk as an ${name} client` : res.reason === 'exists' ? `Won. Already in AUR Desk as "${res.name}"` : 'Won');
  } catch (e) { toast(e.message); return; }
  if (res.ok || res.reason === 'exists') {
    const go = await confirmBox({
      title: res.ok ? 'Added to AUR Desk' : 'Already in AUR Desk',
      text: res.ok ? `${l.name} is now an ${name} client in AUR Desk, with its onboarding checklist ready.` : `AUR Desk already has a client called "${res.name}". Nothing was added twice.`,
      ok: 'Open AUR Desk', cancel: 'Stay here',
    });
    if (go) { location.href = DESK_URL; return; }
  }
  ctx.rerender();
}

function chooseBrand(l) {
  const d = document.getElementById('confirm');
  d.innerHTML = `
    <div class="sheet-handle" aria-hidden="true"></div>
    <h2 class="sheet-title">Won for which business?</h2>
    <p class="sheet-text">${esc(l.name)} becomes a client of the one you pick.</p>
    <div class="sheet-actions">
      <button class="btn btn-studio" data-b="studio">AUR Studio</button>
      <button class="btn btn-printing" data-b="printing">AUR Printing Studio</button>
      <button class="btn btn-ghost" data-b="">Cancel</button>
    </div>`;
  return new Promise((resolve) => {
    d.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => { d.close(); resolve(b.dataset.b || null); }; });
    d.oncancel = (e) => { e.preventDefault(); d.close(); resolve(null); };
    d.showModal();
  });
}

/* ---------- edit contacts ---------- */
function editContacts(ctx, l) {
  const d = document.getElementById('confirm');
  const f = (id, label, value, type = 'text', mode = 'text') => `
    <label class="field">${esc(label)}<input id="e-${id}" type="${type}" inputmode="${mode}" value="${esc(value || '')}" autocomplete="off"></label>`;
  d.innerHTML = `
    <div class="sheet-handle" aria-hidden="true"></div>
    <h2 class="sheet-title">Edit contacts</h2>
    <form id="edit-form" class="sheet-form">
      ${f('phone', 'Phone', l.phone, 'tel', 'tel')}
      ${f('whatsapp', 'WhatsApp (if different)', l.whatsapp, 'tel', 'tel')}
      ${f('email', 'Email', l.email, 'email', 'email')}
      ${f('website', 'Website', l.website, 'url', 'url')}
      ${f('instagram', 'Instagram username', l.instagram)}
      ${f('x', 'X (Twitter) handle', l.x_handle)}
      ${f('telegram', 'Telegram', l.telegram)}
      ${f('linkedin', 'LinkedIn page', l.linkedin, 'url', 'url')}
      <div class="sheet-actions">
        <button class="btn btn-primary" type="submit">Save</button>
        <button class="btn btn-ghost" type="button" data-no>Cancel</button>
      </div>
    </form>`;
  d.querySelector('[data-no]').onclick = () => d.close();
  d.querySelector('#edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const v = (k) => d.querySelector(`#e-${k}`).value.trim() || null;
    const patch = {
      phone: v('phone'), whatsapp: v('whatsapp'), email: v('email') && v('email').toLowerCase(),
      website: v('website'), instagram: v('instagram') && v('instagram').replace(/^@|.*instagram\.com\//g, '').replace(/[/?#].*$/, '').toLowerCase(),
      x_handle: v('x') && cleanX(v('x')).toLowerCase(), telegram: v('telegram') && cleanTelegram(v('telegram')).toLowerCase(),
      linkedin: v('linkedin'),
    };
    try { await updateLead(l, patch, 'Contacts edited'); d.close(); toast('Saved'); ctx.rerender(); }
    catch (err) { toast(err.message); }
  };
  d.showModal();
}
