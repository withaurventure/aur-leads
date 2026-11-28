// Home: business switch, today's numbers, who to call first, follow-ups due, agent status.
import { rest, rpc } from '../api.js';
import { esc, icon, LOGO, num, timeAgo, scoreChip, brandTags, loading, fmtTime, toast } from '../ui.js';
import { telLink, waLink, noteContact } from '../leadactions.js';

const BRAND_IN = { all: '', studio: '&brand=in.(studio,both)', printing: '&brand=in.(printing,both)' };
const COLS = 'id,name,category,city,tier,score,score_reason,brand,status,phone,whatsapp,email,next_followup_at';

export async function renderHome(ctx, _p, view, alive) {
  const { state } = ctx;
  view.innerHTML = `${top(state)}${loading()}`;
  bindTop(ctx, view);

  const b = BRAND_IN[state.brand];
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const [s, hot, due, replies, waq] = await Promise.all([
    rpc('app_summary', { p_brand: state.brand }),
    rest(`v_leads?select=${COLS}&kind=eq.prospect&status=eq.new&score=gte.8&chain=is.false&or=(phone.not.is.null,whatsapp.not.is.null)${b}&order=tier.asc.nullslast,score.desc.nullslast,first_seen_at.desc&limit=5`),
    rest(`v_leads?select=${COLS}&kind=eq.prospect&next_followup_at=lte.${new Date().toISOString()}&status=not.in.(won,lost,do_not_contact)${b}&order=next_followup_at.asc&limit=5`),
    rest(`v_outreach?state=eq.replied&replied_at=gte.${week}&order=replied_at.desc&limit=5`).catch(() => []),
    rest(`v_outreach?state=eq.active&wa_pending_step=not.is.null&order=next_step_at.asc&limit=10`).catch(() => []),
  ]);
  if (!alive()) return;
  const all = [...hot, ...due];

  const kpi = (label, value, sub, go, accent = false) => `
    <button class="kpi${accent ? ' accent' : ''}" data-go="${go}">
      <span class="kpi-label">${esc(label)}</span>
      <span class="kpi-value">${esc(value)}</span>
      <span class="kpi-sub">${esc(sub)}</span>
    </button>`;

  const leadCard = (l) => `
    <article class="lead-card">
      ${scoreChip(l.score)}
      <button class="lead-card-main" data-lead="${l.id}">
        <strong>${esc(l.name)}</strong>
        <span class="muted">${esc([l.category, l.city].filter(Boolean).join(' · '))}</span>
        <span class="muted small">${esc(l.score_reason || '')}</span>
        <span class="tags">${brandTags(l.brand)}</span>
      </button>
      <div class="lead-card-actions">
        ${telLink(l) ? `<a class="round-btn" href="${telLink(l)}" data-contact="${l.id}" data-how="Called" aria-label="Call ${esc(l.name)}">${icon('phone')}</a>` : ''}
        ${waLink(l) ? `<a class="round-btn" href="${waLink(l)}" target="_blank" rel="noopener" data-contact="${l.id}" data-how="WhatsApp chat opened" aria-label="WhatsApp ${esc(l.name)}">${icon('whatsapp')}</a>` : ''}
      </div>
    </article>`;

  const credUsed = Math.max(0, (s.credits_cap || 2500) - (s.credits_left ?? 0));
  const pct = Math.min(100, Math.round((credUsed / (s.credits_cap || 2500)) * 100));

  view.innerHTML = `${top(state)}
    <div class="kpis">
      ${kpi('New today', num(s.new_today), `${num(s.total)} leads in total`, 'leads:new', true)}
      ${kpi('Hot leads', num(s.hot), 'score 8–10, reachable, not contacted', 'leads:hot')}
      ${kpi('Follow-ups due', num(s.followups_due), 'today or overdue', 'leads:due')}
      ${kpi('Open tenders', num(s.open_tenders), 'AUR Printing', 'tenders')}
    </div>

    ${s.to_review ? `<button class="banner" data-go="review">${icon('merge')}<span><strong>${num(s.to_review)} possible duplicates</strong> to check</span>${icon('right')}</button>` : ''}

    ${replies.length ? `<section class="section">
      <div class="section-head"><div><h2>Replies</h2><small class="muted">They answered. Call or message them now</small></div></div>
      ${replies.map((r) => `<button class="card reply-card" data-lead="${r.lead_id}">
        <span class="reply-dot" aria-hidden="true"></span>
        <span class="row-main"><strong>${esc(r.name)}</strong>
          <span class="muted small">Replied by ${esc(r.replied_via || '')} · ${esc(timeAgo(r.replied_at))}</span>
          ${r.reply_snippet ? `<span class="small">“${esc(r.reply_snippet.slice(0, 140))}”</span>` : ''}</span>
        ${icon('right', 'chev')}</button>`).join('')}
    </section>` : ''}

    ${waq.length ? `<section class="section">
      <div class="section-head"><div><h2>WhatsApp follow-ups</h2><small class="muted">Written for you. One tap each</small></div></div>
      ${waq.map((o) => `<div class="card wa-card">
        <div class="row-main"><strong>${esc(o.name)}</strong><span class="muted small">Follow-up ${o.wa_pending_step} of ${o.total_steps - 1}${o.city ? ' · ' + esc(o.city) : ''}</span>
          <span class="small wa-preview">${esc((o.wa_pending_text || '').slice(0, 160))}${(o.wa_pending_text || '').length > 160 ? '…' : ''}</span></div>
        <div class="two">
          <button class="btn btn-wa btn-small" data-wa-send="${o.id}">${icon('whatsapp')}Send</button>
          <button class="btn btn-outline btn-small" data-wa-replied="${o.id}">They replied</button>
        </div></div>`).join('')}
    </section>` : ''}

    <section class="section">
      <div class="section-head"><div><h2>Call first</h2><small class="muted">Prayagraj first, then UP, then big cities</small></div><button class="link-btn" data-go="leads:hot">See all</button></div>
      ${hot.length ? hot.map(leadCard).join('') : '<div class="empty">No uncontacted hot leads with a phone number right now. The agent keeps looking.</div>'}
    </section>

    ${due.length ? `<section class="section">
      <div class="section-head"><h2>Follow up</h2><button class="link-btn" data-go="leads:due">See all</button></div>
      ${due.map(leadCard).join('')}
    </section>` : ''}

    <section class="card agent">
      <h2>Agent today</h2>
      <div class="row-kv"><span>Lead search</span><strong>${s.last_collect ? `last ${timeAgo(s.last_collect)}` : 'not run yet'}${s.next_city ? ` · next: ${esc(s.next_city)}` : ''}</strong></div>
      <div class="row-kv"><span>Searches today</span><strong>${num(s.searches_today)}</strong></div>
      <div class="row-kv"><span>Leads checked for contacts</span><strong>${num(s.sites_today)}</strong></div>
      <div class="row-kv"><span>Leads with a phone</span><strong>${num(s.with_phone)} of ${num(s.total)}</strong></div>
      <div class="row-kv"><span>Free map credits today</span><strong>${num(credUsed)} / ${num(s.credits_cap || 2500)}</strong></div>
      <div class="meter" aria-hidden="true"><span style="width:${pct}%"></span></div>
    </section>
    <p class="attribution">Map data © OpenStreetMap contributors · Powered by Geoapify</p>`;
  bindTop(ctx, view);

  view.querySelectorAll('[data-go]').forEach((el) => {
    el.onclick = () => {
      const [screen, preset] = el.dataset.go.split(':');
      if (screen === 'leads') {
        const f = ctx.state.leadFilters;
        Object.assign(f, { minScore: 0, city: '', category: '', hasPhone: false, mobile: false, email: false, noSite: false, week: false, ready: false, showAll: false, status: '', due: false, q: '', sort: 'local', newToday: false });
        f.brand = ctx.state.brand === 'all' ? '' : ctx.state.brand;
        if (preset === 'hot') Object.assign(f, { minScore: 8, status: 'new', sort: 'local' });
        if (preset === 'due') f.due = true;
        if (preset === 'new') Object.assign(f, { newToday: true, sort: 'newest' });
        ctx.tab('leads');
      } else ctx.tab(screen);
    };
  });
  view.querySelectorAll('[data-wa-send]').forEach((btn) => {
    btn.onclick = async () => {
      const o = waq.find((x) => x.id === btn.dataset.waSend);
      if (!o) return;
      window.open(`https://wa.me/${o.wa_to}?text=${encodeURIComponent(o.wa_pending_text || '')}`, '_blank', 'noopener');
      try { await rpc('record_send', { p_id: o.id, p_step: o.wa_pending_step, p_channel: 'whatsapp', p_ok: true }); toast('Follow-up sent'); ctx.rerender(); }
      catch (e) { toast('Could not record it: ' + e.message); }
    };
  });
  view.querySelectorAll('[data-wa-replied]').forEach((btn) => {
    btn.onclick = async () => {
      try { await rpc('mark_replied', { p_id: btn.dataset.waReplied, p_via: 'WhatsApp' }); toast('Marked as replied. Follow-ups stopped.'); ctx.rerender(); }
      catch (e) { toast('Could not save: ' + e.message); }
    };
  });
  view.querySelectorAll('[data-lead]').forEach((el) => { el.onclick = () => ctx.go('lead', { id: el.dataset.lead }); });
  view.querySelectorAll('[data-contact]').forEach((el) => {
    el.addEventListener('click', () => {
      const l = all.find((x) => x.id === el.dataset.contact);
      if (l) noteContact(l, el.dataset.how);
    });
  });
}

function top(state) {
  const seg = (v, label) => `<button role="tab" aria-selected="${state.brand === v}" data-brand="${v}">${label}</button>`;
  return `
    <header class="home-head">
      ${LOGO(40)}
      <div class="home-title">
        <h1>AUR <span>Leads</span></h1>
        <small><span class="live-dot" aria-hidden="true"></span>Agent runs every 20 minutes · ${esc(fmtTime(new Date().toISOString()))}</small>
      </div>
      <button class="icon-btn bell" data-alerts aria-label="Alerts">${icon('bell')}<span class="bell-count" id="bell-count" hidden></span></button>
      <button class="icon-btn" data-settings aria-label="Settings">${icon('gear')}</button>
    </header>
    <div class="segmented" role="tablist" aria-label="Business">
      ${seg('all', 'All')}${seg('studio', 'AUR Studio')}${seg('printing', 'AUR Printing')}
    </div>`;
}

function bindTop(ctx, view) {
  view.querySelectorAll('[data-brand]').forEach((b) => { b.onclick = () => { ctx.state.brand = b.dataset.brand; ctx.rerender(); }; });
  const s = view.querySelector('[data-search]'); if (s) s.onclick = () => ctx.tab('leads');
  const g = view.querySelector('[data-settings]'); if (g) g.onclick = () => ctx.go('settings');
  const a = view.querySelector('[data-alerts]');
  if (a) {
    a.onclick = () => ctx.go('alerts');
    rest('notifications?select=id&read_at=is.null', { count: true }).then(({ total }) => {
      const el = view.querySelector('#bell-count');
      if (el && total) { el.textContent = total > 9 ? '9+' : String(total); el.hidden = false; }
    }).catch(() => {});
  }
}
