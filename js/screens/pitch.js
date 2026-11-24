// Pitch: choose the brand, pick services, edit the words, then send the PDF by WhatsApp or email.
import { rest, enc } from '../api.js';
import { esc, icon, pageHeader, toast, loading } from '../ui.js';
import { BRANDS, pitchConfig, parseService, defaultBrand } from '../brands.js';
import { draftIntro, draftNotes, draftMessage, emailSubject } from '../pitchtext.js';
import { buildPitchPdf, sharePdf, downloadFile } from '../pdf.js';
import { notePitch, waLink, mailLink } from '../leadactions.js';

const drafts = new Map();   // keeps your edits if you step away and come back

export async function renderPitch(ctx, { id }, view, alive) {
  view.innerHTML = pageHeader('Pitch') + loading();
  const [rows, cfg] = await Promise.all([rest(`v_leads?id=eq.${enc(id)}&select=*`), pitchConfig()]);
  if (!alive()) return;
  const lead = rows[0];
  if (!lead) { view.innerHTML = pageHeader('Pitch') + '<div class="empty">Lead not found.</div>'; return; }

  let d = drafts.get(id);
  const fresh = (brand) => ({
    brand,
    intro: draftIntro(lead, brand, cfg),
    notes: draftNotes(lead, brand).join('\n'),
    services: new Set(cfg[brand].services.slice(0, 2)),
    message: draftMessage(lead, brand, cfg),
  });
  if (!d) { d = fresh(defaultBrand(lead)); drafts.set(id, d); }

  const draw = () => {
    const B = BRANDS[d.brand], b = cfg[d.brand];
    view.innerHTML = `
      ${pageHeader('Pitch', { sub: lead.name })}
      <div class="segmented brandpick" role="tablist" aria-label="Send as">
        <button role="tab" aria-selected="${d.brand === 'studio'}" data-brand="studio">AUR Studio</button>
        <button role="tab" aria-selected="${d.brand === 'printing'}" data-brand="printing">AUR Printing Studio</button>
      </div>

      <div class="pitch-brand" style="--b:${B.primary};--bs:${B.soft}">
        <img src="${B.logo}" alt="${esc(b.name)} logo" width="56" height="56">
        <div><strong>${esc(b.name)}</strong><small>${esc([b.whatsapp, b.email || 'no email yet'].filter(Boolean).join(' · '))}</small></div>
      </div>

      <section class="card">
        <h2>Services to include</h2>
        ${cfg[d.brand].services.map((s, i) => {
          const p = parseService(s);
          return `<label class="check-row"><input type="checkbox" data-svc="${i}" ${d.services.has(s) ? 'checked' : ''}><span><strong>${esc(p.title)}</strong>${p.text ? `<small>${esc(p.text)}</small>` : ''}</span></label>`;
        }).join('')}
        <p class="muted small">No prices go on the proposal. You change this list in Settings.</p>
      </section>

      <section class="card">
        <h2>Opening</h2>
        <label class="sr-only" for="intro">Opening paragraph</label>
        <textarea id="intro" rows="6">${esc(d.intro)}</textarea>
        <h2 class="mt">${d.brand === 'printing' ? 'What they may need' : 'What we noticed'} <small class="muted">one point per line</small></h2>
        <label class="sr-only" for="notes">Points</label>
        <textarea id="notes" rows="6">${esc(d.notes)}</textarea>
        <button class="link-btn" data-reset>${icon('refresh', 'inline')}Start again from the draft</button>
      </section>

      <section class="card">
        <h2>Message with the PDF</h2>
        <label class="sr-only" for="msg">Message</label>
        <textarea id="msg" rows="4">${esc(d.message)}</textarea>
      </section>

      <div class="action-bar stacked">
        <button class="btn btn-wa" data-send="whatsapp">${icon('whatsapp')}Share PDF on WhatsApp</button>
        <div class="two">
          <button class="btn btn-outline" data-send="email">${icon('mail')}Email</button>
          <button class="btn btn-ghost" data-save>${icon('download')}Save PDF</button>
        </div>
      </div>`;
    bind();
  };

  const read = () => {
    d.intro = view.querySelector('#intro').value;
    d.notes = view.querySelector('#notes').value;
    d.message = view.querySelector('#msg').value;
  };
  const services = () => cfg[d.brand].services.filter((s) => d.services.has(s));
  const make = async () => buildPitchPdf({
    brand: d.brand, lead, cfg, intro: d.intro.trim(),
    notes: d.notes.split('\n').map((x) => x.trim()).filter(Boolean),
    services: services(),
    date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  });

  async function record(channel) {
    try {
      await rest('pitches', { method: 'POST', body: {
        lead_id: lead.id, brand: d.brand, channel, subject: emailSubject(lead, d.brand, cfg),
        body: d.message, sent_at: new Date().toISOString(),
      } });
      await notePitch(lead, cfg[d.brand].name, channel === 'whatsapp' ? 'WhatsApp' : 'email');
    } catch { /* the PDF still went out; logging can fail offline */ }
  }

  function bind() {
    view.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => { read(); ctx.back(); }; });
    view.querySelectorAll('[data-brand]').forEach((btn) => {
      btn.onclick = () => {
        if (btn.dataset.brand === d.brand) return;
        read();
        d = fresh(btn.dataset.brand); drafts.set(id, d); draw();
      };
    });
    view.querySelectorAll('[data-svc]').forEach((c) => {
      c.onchange = () => { const s = cfg[d.brand].services[c.dataset.svc]; c.checked ? d.services.add(s) : d.services.delete(s); };
    });
    view.querySelector('[data-reset]').onclick = () => { d = fresh(d.brand); drafts.set(id, d); draw(); toast('Draft restored'); };

    view.querySelectorAll('[data-send]').forEach((btn) => {
      btn.onclick = async () => {
        read();
        if (!services().length) { toast('Pick at least one service'); return; }
        const channel = btn.dataset.send;
        btn.disabled = true;
        const label = btn.innerHTML;
        btn.textContent = 'Making PDF…';
        try {
          const file = await make();
          let text = d.message;
          if (channel === 'email') text = `${d.message}\n\n${cfg.sender}\n${cfg[d.brand].name}`;
          const res = await sharePdf(file, text, emailSubject(lead, d.brand, cfg));
          if (res === 'shared') { await record(channel); toast('Pitch sent. Follow-up set for 3 days'); }
          else if (res === 'downloaded') {
            toast('Sharing is not available here, so the PDF was saved instead');
            const link = channel === 'whatsapp' ? waLink(lead, d.message) : mailLink(lead, emailSubject(lead, d.brand, cfg), d.message);
            if (link) window.open(link, '_blank', 'noopener');
            await record(channel);
          }
        } catch (e) {
          toast(e.message || 'Could not make the PDF');
        } finally { btn.disabled = false; btn.innerHTML = label; }
      };
    });
    view.querySelector('[data-save]').onclick = async (e) => {
      read();
      const btn = e.currentTarget;
      btn.disabled = true;
      try { downloadFile(await make()); toast('PDF saved to Downloads'); }
      catch (err) { toast(err.message || 'Could not make the PDF'); }
      finally { btn.disabled = false; }
    };
  }

  draw();
}
