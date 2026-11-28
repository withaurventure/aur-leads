// Audit: a short online-presence report for one lead, sent as a private link
// on WhatsApp (one tap) or by email (sent for you from your Gmail).
import { rest, rpc, enc, callFunction } from '../api.js';
import { esc, icon, pageHeader, toast, loading } from '../ui.js';
import { pitchConfig } from '../brands.js';
import { buildAudit, allFindings, MANUAL, auditLink, whatsappText, emailContent } from '../audit.js';
import { waLink } from '../leadactions.js';

const state = new Map();   // per lead: switched-off findings, ticked checks, last saved audit

const newToken = () => (crypto.randomUUID ? crypto.randomUUID() + crypto.randomUUID() : String(Math.random()).slice(2) + Date.now() + String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 40);

export async function renderAudit(ctx, { id }, view, alive) {
  view.innerHTML = pageHeader('Audit') + loading();
  const [rows, cfg] = await Promise.all([rest(`v_leads?id=eq.${enc(id)}&select=*`), pitchConfig()]);
  if (!alive()) return;
  const lead = rows[0];
  if (!lead) { view.innerHTML = pageHeader('Audit') + '<div class="empty">Lead not found.</div>'; return; }

  let s = state.get(id);
  if (!s) { s = { off: new Set(), manual: new Set(), saved: null }; state.set(id, s); }
  const checks = lead.segment === 'web3' ? MANUAL.web3 : MANUAL.local;
  const current = () => buildAudit(lead, cfg, { off: [...s.off], manual: [...s.manual] });
  const sig = (a) => JSON.stringify({ f: a.findings, p: a.positives, s: a.score });

  const igUrl = lead.instagram ? `https://instagram.com/${lead.instagram}` : '';
  const xUrl = lead.x_handle ? `https://x.com/${lead.x_handle}` : '';
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([lead.name, lead.city].filter(Boolean).join(' '))}`;
  const wa = waLink(lead);
  const websiteChecked = !lead.website || lead.site_audit?.checked_at || lead.website_ok === false;

  const draw = () => {
    const a = current();
    const found = allFindings(lead, [...s.manual]).sort((x, y) => y.weight - x.weight);
    view.innerHTML = `
      ${pageHeader('Audit', { sub: lead.name })}
      <section class="card audit-score">
        <div class="ring" style="--p:${a.score * 10}"><span>${a.score}</span><small>/10</small></div>
        <div><strong>Online presence score</strong>
          <span class="muted small">${a.findings.length ? `${a.findings.length} ${a.findings.length === 1 ? 'problem' : 'problems'} will go in the audit` : 'No problems found yet. Tick what you see below.'}</span>
          ${!websiteChecked ? '<span class="muted small">Website checks are still running for this lead. Try again later for a fuller audit.</span>' : ''}
        </div>
      </section>

      <section class="card">
        <h2>Your 10-second check</h2>
        <p class="muted small">Open their page, then tick what you see. Apps cannot read these, so this is what makes the audit personal.</p>
        <div class="quick-links">
          ${igUrl ? `<a class="btn btn-small" href="${esc(igUrl)}" target="_blank" rel="noopener">${icon('camera')}Instagram</a>` : ''}
          ${xUrl ? `<a class="btn btn-small" href="${esc(xUrl)}" target="_blank" rel="noopener">${icon('x')}X</a>` : ''}
          ${lead.segment !== 'web3' ? `<a class="btn btn-small" href="${esc(mapsUrl)}" target="_blank" rel="noopener">${icon('pin')}Google Maps</a>` : ''}
          ${lead.website ? `<a class="btn btn-small" href="${esc(/^https?:/.test(lead.website) ? lead.website : 'https://' + lead.website)}" target="_blank" rel="noopener">${icon('globe')}Website</a>` : ''}
        </div>
        ${checks.map(([k, label]) => `<label class="check-row"><input type="checkbox" data-manual="${k}" ${s.manual.has(k) ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}
      </section>

      <section class="card">
        <h2>What goes in the audit</h2>
        <p class="muted small">Untick anything that is not right. The top 5 are used.</p>
        ${found.length ? found.map((f) => `<label class="check-row"><input type="checkbox" data-finding="${f.key}" ${s.off.has(f.key) ? '' : 'checked'}>
            <span><strong>${esc(f.title)}</strong><small>${esc(f.detail)}</small></span></label>`).join('')
          : '<p class="muted">Nothing found automatically. Use the quick check above.</p>'}
        ${a.positives.length ? `<h2 class="mt">What is working <small class="muted">(shown too, so it reads fair)</small></h2>
          <ul class="plain-list">${a.positives.map((p) => `<li>${icon('check', 'inline')}${esc(p)}</li>`).join('')}</ul>` : ''}
      </section>

      <div class="action-bar stacked">
        <button class="btn btn-wa" data-wa ${wa && a.findings.length ? '' : 'disabled'}>${icon('whatsapp')}${wa ? 'Send on WhatsApp' : 'No WhatsApp number'}</button>
        <div class="two">
          <button class="btn btn-outline" data-email ${lead.email && a.findings.length ? '' : 'disabled'}>${icon('mail')}${lead.email ? 'Send by email' : 'No email'}</button>
          <button class="btn btn-ghost" data-preview ${a.findings.length ? '' : 'disabled'}>${icon('eye')}Preview</button>
        </div>
      </div>`;
    bind();
  };

  // Save this version of the audit once; reuse its link while nothing changes.
  async function save(a, token) {
    if (s.saved && s.saved.sig === sig(a)) return s.saved;
    const r = await rpc('save_audit', { p: { lead_id: lead.id, brand: 'studio', data: a, token } });
    s.saved = { id: r.id, token: r.token, sig: sig(a) };
    return s.saved;
  }
  const tokenFor = (a) => (s.saved && s.saved.sig === sig(a) ? s.saved.token : newToken());

  function bind() {
    view.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => ctx.back(); });
    view.querySelectorAll('[data-manual]').forEach((c) => {
      c.onchange = () => { c.checked ? s.manual.add(c.dataset.manual) : s.manual.delete(c.dataset.manual); draw(); };
    });
    view.querySelectorAll('[data-finding]').forEach((c) => {
      c.onchange = () => { c.checked ? s.off.delete(c.dataset.finding) : s.off.add(c.dataset.finding); draw(); };
    });

    // WhatsApp: open the chat straight away (one tap), save the audit behind it
    const waBtn = view.querySelector('[data-wa]');
    if (waBtn) waBtn.onclick = async () => {
      const a = current();
      const token = tokenFor(a);
      window.open(waLink(lead, whatsappText(lead, a, auditLink(token), cfg)), '_blank', 'noopener');
      try {
        const saved = await save(a, token);
        await rpc('mark_audit_sent', { p_id: saved.id, p_via: 'WhatsApp' });
        toast('Audit link sent. You will see when they open it.');
      } catch (e) {
        s.saved = null;
        toast('The audit link could not be saved. Send it again: ' + e.message);
      }
    };

    const mailBtn = view.querySelector('[data-email]');
    if (mailBtn) mailBtn.onclick = async () => {
      const a = current();
      mailBtn.disabled = true; mailBtn.textContent = 'Sending…';
      try {
        const saved = await save(a, tokenFor(a));
        const mail = emailContent(lead, a, auditLink(saved.token), cfg);
        await callFunction('send-audit', {
          audit_id: saved.id, to: lead.email, subject: mail.subject, html: mail.html, text: mail.text,
          from_name: `${cfg.sender} · ${cfg.studio.name}`, reply_to: cfg.studio.email,
        });
        await rpc('mark_audit_sent', { p_id: saved.id, p_via: 'email' });
        toast(`Audit emailed to ${lead.email}`);
        mailBtn.textContent = 'Sent';
      } catch (e) {
        toast('Email not sent: ' + e.message);
        mailBtn.disabled = false; mailBtn.innerHTML = `${icon('mail')}Send by email`;
      }
    };

    const prev = view.querySelector('[data-preview]');
    if (prev) prev.onclick = async () => {
      const a = current();
      prev.disabled = true;
      try {
        const saved = await save(a, tokenFor(a));
        window.open(auditLink(saved.token) + '&preview=1', '_blank', 'noopener');
      } catch (e) { toast('Could not open preview: ' + e.message); }
      prev.disabled = false;
    };
  }

  draw();
}
