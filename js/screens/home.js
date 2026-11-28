// Home: business switch, today's numbers, who to call first, follow-ups due, agent status.
import { rest, rpc } from '../api.js';
import { esc, icon, LOGO, num, timeAgo, scoreChip, brandTags, loading, fmtTime } from '../ui.js';
import { telLink, waLink, noteContact } from '../leadactions.js';

const BRAND_IN = { all: '', studio: '&brand=in.(studio,both)', printing: '&brand=in.(printing,both)' };
const COLS = 'id,name,category,city,tier,score,score_reason,brand,status,phone,whatsapp,email,next_followup_at';

export async function renderHome(ctx, _p, view, alive) {
  const { state } = ctx;
  view.innerHTML = `${top(state)}${loading()}`;
  bindTop(ctx, view);

  const b = BRAND_IN[state.brand];
  const [s, hot, due] = await Promise.all([
    rpc('app_summary', { p_brand: state.brand }),
    rest(`v_leads?select=${COLS}&kind=eq.prospect&status=eq.new&score=gte.8&chain=is.false&or=(phone.not.is.null,whatsapp.not.is.null)${b}&order=tier.asc.nullslast,score.desc.nullslast,first_seen_at.desc&limit=5`),
    rest(`v_leads?select=${COLS}&kind=eq.prospect&next_followup_at=lte.${new Date().toISOString()}&status=not.in.(won,lost,do_not_contact)${b}&order=next_followup_at.asc&limit=5`),
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
      <button class="icon-btn" data-search aria-label="Search leads">${icon('search')}</button>
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
}
