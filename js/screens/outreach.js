// Send: the first message for WhatsApp and email, written for this lead, plus the automatic follow-ups.
// You check it, confirm once, and both go out. Follow-ups run by themselves until the lead replies.
import { rest, rpc, enc, callFunction } from '../api.js';
import { esc, icon, pageHeader, toast, loading } from '../ui.js';
import { pitchConfig } from '../brands.js';
import { buildAudit, auditLink, prefsFor, newToken } from '../audit.js';
import { draftSteps, outreachBrand, toHtml, FOLLOWUP_DAYS } from '../outreach.js';
import { waLink } from '../leadactions.js';

const drafts = new Map();   // keeps your edits while you move around the app

const dayLabel = (days) => {
  const d = new Date(Date.now() + days * 864e5);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export async function renderOutreach(ctx, { id }, view, alive) {
  view.innerHTML = pageHeader('Send') + loading();
  const [rows, cfg, active] = await Promise.all([
    rest(`v_leads?id=eq.${enc(id)}&select=*`), pitchConfig(),
    rest(`outreach?lead_id=eq.${enc(id)}&state=eq.active&select=id,created_at&limit=1`).catch(() => []),
  ]);
  if (!alive()) return;
  const lead = rows[0];
  if (!lead) { view.innerHTML = pageHeader('Send') + '<div class="empty">Lead not found.</div>'; return; }

  const brand = outreachBrand(lead);
  const wa = waLink(lead);
  const canEmail = !!lead.email;
  const prefs = prefsFor(id);
  const audit = brand === 'studio' ? buildAudit(lead, cfg, { off: [...prefs.off], manual: [...prefs.manual] }) : null;
  const useAudit = !!(audit && audit.findings.length);

  let d = drafts.get(id);
  if (!d || d.sig !== JSON.stringify(audit?.findings || [])) {
    const token = newToken();
    d = { token, sig: JSON.stringify(audit?.findings || []), steps: draftSteps(lead, cfg, useAudit ? audit : null, useAudit ? auditLink(token) : null),
          useWa: !!wa, useEmail: canEmail };
    drafts.set(id, d);
  }

  const stepBox = (s, i) => `
    <section class="card step-card">
      <h2>${i === 0 ? 'First message' : `Follow-up ${i} <small class="muted">${dayLabel(s.day)}, only if no reply</small>`}</h2>
      ${d.useWa ? `<label class="field">WhatsApp${i > 0 ? ' <small class="muted">(waits for your one tap)</small>' : ''}<textarea data-wa="${i}" rows="${i ? 4 : 6}">${esc(s.wa)}</textarea></label>` : ''}
      ${d.useEmail ? `<label class="field">Email subject<input data-subj="${i}" value="${esc(s.email.subject)}"></label>
        <label class="field">Email${i > 0 ? ' <small class="muted">(sent automatically, in the same conversation)</small>' : ''}<textarea data-mail="${i}" rows="${i ? 6 : 9}">${esc(s.email.text)}</textarea></label>` : ''}
    </section>`;

  const draw = () => {
    view.innerHTML = `
      ${pageHeader('Send', { sub: lead.name })}
      ${active.length ? `<div class="notice">A message sequence is already running for this lead. Sending again stops the old follow-ups and starts new ones.</div>` : ''}
      <section class="card">
        <h2>Send by</h2>
        <label class="check-row"><input type="checkbox" data-use="wa" ${d.useWa ? 'checked' : ''} ${wa ? '' : 'disabled'}>
          <span><strong>WhatsApp</strong><small>${wa ? esc(lead.whatsapp || lead.phone) : 'No mobile number for this lead'}</small></span></label>
        <label class="check-row"><input type="checkbox" data-use="email" ${d.useEmail ? 'checked' : ''} ${canEmail ? '' : 'disabled'}>
          <span><strong>Email</strong><small>${canEmail ? esc(lead.email) + ' · sent from your Gmail' : 'No email for this lead'}</small></span></label>
        ${brand === 'studio' ? `<p class="muted small">${useAudit ? `Includes their audit link (score ${audit.score}/10, ${audit.findings.length} problems).` : 'No audit problems found yet, so this is a short introduction.'}
          <button class="link-btn" data-audit>${icon('audit', 'inline')}Check the audit first</button></p>` : ''}
      </section>
      ${d.steps.map(stepBox).join('')}
      <p class="muted small pad">Follow-ups stop by themselves as soon as they reply by email, or when you tap “They replied”.</p>
      <div class="action-bar">
        <button class="btn btn-primary btn-block" data-send ${(d.useWa || d.useEmail) ? '' : 'disabled'}>${icon('share')}Review and send</button>
      </div>`;
    bind();
  };

  const read = () => {
    d.steps.forEach((s, i) => {
      const w = view.querySelector(`[data-wa="${i}"]`); if (w) s.wa = w.value.trim();
      const sj = view.querySelector(`[data-subj="${i}"]`); if (sj) s.email.subject = sj.value.trim();
      const m = view.querySelector(`[data-mail="${i}"]`);
      if (m && m.value.trim() !== s.email.text) { s.email.text = m.value.trim(); s.email.html = toHtml(s.email.text); }
    });
  };

  async function sendAll() {
    read();
    const steps = d.steps.map((s) => ({ day: s.day, wa: d.useWa ? s.wa : null, email: d.useEmail ? s.email : null }));
    // 1. WhatsApp opens straight away (one tap to Send inside WhatsApp)
    if (d.useWa) window.open(waLink(lead, steps[0].wa), '_blank', 'noopener');
    try {
      // 2. save the audit behind the link
      let auditId = null;
      if (useAudit) {
        const r = await rpc('save_audit', { p: { lead_id: lead.id, brand: 'studio', data: audit, token: d.token } });
        auditId = r.id;
      }
      // 3. start the sequence (records the WhatsApp message, plans the follow-ups)
      const o = await rpc('start_outreach', { p: {
        lead_id: lead.id, brand, audit_id: auditId, steps,
        email_to: d.useEmail ? lead.email : null,
        wa_to: d.useWa ? String(lead.whatsapp || lead.phone || '').replace(/\D/g, '') : null,
        wa_sent: d.useWa,
      } });
      if (auditId && d.useWa) await rpc('mark_audit_sent', { p_id: auditId, p_via: 'WhatsApp', p_set_status: false }).catch(() => {});
      // 4. the email goes out from your Gmail
      if (d.useEmail) {
        await callFunction('send-audit', { outreach_id: o.id, step: 0, to: lead.email, ...steps[0].email });
        if (auditId) await rpc('mark_audit_sent', { p_id: auditId, p_via: 'email', p_set_status: false }).catch(() => {});
      }
      drafts.delete(id);
      toast(d.useEmail ? 'Sent. Follow-ups are planned.' : 'Recorded. Follow-ups are planned.');
      ctx.go('lead', { id: lead.id });
    } catch (e) {
      toast('Not everything went out: ' + e.message);
    }
  }

  function bind() {
    view.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => { read(); ctx.back(); }; });
    view.querySelectorAll('[data-use]').forEach((c) => {
      c.onchange = () => { read(); if (c.dataset.use === 'wa') d.useWa = c.checked; else d.useEmail = c.checked; draw(); };
    });
    const au = view.querySelector('[data-audit]');
    if (au) au.onclick = () => { read(); drafts.delete(id); ctx.go('audit', { id: lead.id }); };
    view.querySelector('[data-send]').onclick = () => {
      read();
      const dlg = document.getElementById('confirm');
      const parts = [d.useWa && `WhatsApp to ${esc(lead.whatsapp || lead.phone)} <small>(opens WhatsApp, you tap Send)</small>`,
                     d.useEmail && `Email to ${esc(lead.email)} <small>(sent automatically)</small>`].filter(Boolean);
      dlg.innerHTML = `
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 class="sheet-title">Send to ${esc(lead.name)}?</h2>
        <ul class="plain-list">${parts.map((p) => `<li>${icon('check', 'inline')}<span>${p}</span></li>`).join('')}</ul>
        <p class="sheet-text">If they don't reply: follow-up 1 on ${dayLabel(FOLLOWUP_DAYS[0])}, follow-up 2 on ${dayLabel(FOLLOWUP_DAYS[1])}. Emails go by themselves; WhatsApp ones appear on Home for one tap.</p>
        <div class="sheet-actions">
          <button class="btn btn-primary" data-yes>${icon('share')}Send now</button>
          <button class="btn btn-ghost" data-no>Cancel</button>
        </div>`;
      dlg.querySelector('[data-no]').onclick = () => dlg.close();
      dlg.querySelector('[data-yes]').onclick = () => { dlg.close(); sendAll(); };
      dlg.showModal();
    };
  }

  draw();
}
