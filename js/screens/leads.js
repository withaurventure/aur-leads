// Leads: search, quick filters, city, sort; loads 40 at a time.
import { rest, rpc, q, enc } from '../api.js';
import { esc, icon, num, scoreChip, brandTags, statusTag, loading, emptyBox } from '../ui.js';
import { openQuickAdd } from '../quickadd.js';

const PAGE = 40;
const COLS = 'id,name,category,city,tier,score,brand,segment,status,phone,whatsapp,email,website,instagram,x_handle,telegram,linkedin,next_followup_at';
let cities = null;

export function buildQuery(f, offset = 0) {
  const p = [`select=${COLS}`, 'kind=eq.prospect'];
  const and = [];
  if (f.minScore) p.push(`score=gte.${f.minScore}`);
  if (f.city) p.push(`city=eq.${enc(f.city)}`);
  if (f.brand === 'studio') p.push('brand=in.(studio,both)');
  if (f.brand === 'printing') p.push('brand=in.(printing,both)');
  if (f.web3) p.push('segment=eq.web3');
  if (f.status) p.push(`status=eq.${f.status}`);
  if (f.due) { p.push(`next_followup_at=lte.${enc(new Date().toISOString())}`); p.push('status=not.in.(won,lost,do_not_contact)'); }
  if (f.newToday) p.push(`first_seen_at=gte.${enc(istMidnight())}`);
  if (f.hasPhone) and.push('or(phone.not.is.null,whatsapp.not.is.null)');
  const text = (f.q || '').trim();
  if (text) {
    const v = q(`*${text}*`);
    and.push(`or(name.ilike.${v},category.ilike.${v},phone.ilike.${v},email.ilike.${v},city.ilike.${v},x_handle.ilike.${v},telegram.ilike.${v})`);
  }
  if (and.length) p.push(`and=(${enc(and.join(','))})`);
  const order = { local: 'tier.asc.nullslast,score.desc.nullslast,first_seen_at.desc', score: 'score.desc.nullslast,tier.asc.nullslast,first_seen_at.desc', newest: 'first_seen_at.desc', name: 'name.asc', followup: 'next_followup_at.asc.nullslast' }[f.sort] || 'tier.asc.nullslast,score.desc.nullslast';
  p.push(`order=${order}`, `limit=${PAGE}`, `offset=${offset}`);
  return 'v_leads?' + p.join('&');
}

// midnight today in India, as an ISO timestamp
export function istMidnight(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 330 * 60000).toISOString();
}

export async function renderLeads(ctx, _p, view, alive) {
  const f = ctx.state.leadFilters;
  const chip = (key, label, on) => `<button class="chip" aria-pressed="${!!on}" data-chip="${key}">${esc(label)}</button>`;

  if (!cities) cities = await rpc('lead_cities').catch(() => []);
  view.innerHTML = `
    <header class="page-head plain"><div class="page-head-text"><h1>Leads</h1><small id="total"></small></div>
      <button class="btn btn-small btn-primary" data-add>${icon('plus')}Add lead</button></header>
    <form class="search" role="search" id="search-form">
      ${icon('search')}
      <label class="sr-only" for="q">Search leads</label>
      <input id="q" type="search" placeholder="Search name, phone, category" value="${esc(f.q)}" enterkeyhint="search" autocomplete="off">
    </form>
    <div class="chips" aria-label="Filters">
      ${chip('hot', 'Score 7+', f.minScore >= 7)}
      ${chip('phone', 'Has phone', f.hasPhone)}
      ${chip('new', 'Not contacted', f.status === 'new')}
      ${chip('studio', 'Studio', f.brand === 'studio')}
      ${chip('printing', 'Printing', f.brand === 'printing')}
      ${chip('web3', 'Web3', f.web3)}
      ${chip('due', 'Follow-up due', f.due)}
      ${f.newToday ? chip('today', 'Found today', true) : ''}
    </div>
    <div class="list-tools">
      <label class="select-wrap"><span class="sr-only">City</span>
        <select id="city"><option value="">All cities</option>${(cities || []).map((c) => `<option value="${esc(c.city)}" ${c.city === f.city ? 'selected' : ''}>${esc(c.city)} (${num(c.leads)})</option>`).join('')}</select>
      </label>
      <label class="select-wrap"><span class="sr-only">Sort</span>
        <select id="sort">
          ${[['local', 'Prayagraj first'], ['score', 'Best score'], ['newest', 'Newest'], ['name', 'Name A–Z'], ['followup', 'Follow-up date']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </label>
    </div>
    <div id="rows" class="rows">${loading()}</div>
    <div id="more"></div>`;

  let offset = 0;
  let rows = [];
  async function load(append = false) {
    const res = await rest(buildQuery(f, offset), { count: true });
    if (!alive()) return;
    rows = append ? rows.concat(res.rows) : res.rows;
    view.querySelector('#total').textContent = `${num(res.total)} ${res.total === 1 ? 'lead' : 'leads'}`;
    const box = view.querySelector('#rows');
    box.innerHTML = rows.length ? rows.map(row).join('') : emptyBox('No leads match. Try removing a filter.');
    const more = view.querySelector('#more');
    more.innerHTML = rows.length < res.total ? `<button class="btn btn-ghost btn-block" data-more>Show more (${num(res.total - rows.length)} left)</button>` : '';
    const m = more.querySelector('[data-more]');
    if (m) m.onclick = async () => { m.disabled = true; m.textContent = 'Loading…'; offset += PAGE; await load(true); };
    box.querySelectorAll('[data-lead]').forEach((el) => { el.onclick = () => ctx.go('lead', { id: el.dataset.lead }); });
  }

  const reload = () => { offset = 0; ctx.rerender(); };
  view.querySelectorAll('[data-chip]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.chip;
      if (k === 'hot') f.minScore = f.minScore >= 7 ? 0 : 7;
      if (k === 'phone') f.hasPhone = !f.hasPhone;
      if (k === 'new') f.status = f.status === 'new' ? '' : 'new';
      if (k === 'studio') f.brand = f.brand === 'studio' ? '' : 'studio';
      if (k === 'printing') f.brand = f.brand === 'printing' ? '' : 'printing';
      if (k === 'due') f.due = !f.due;
      if (k === 'web3') f.web3 = !f.web3;
      if (k === 'today') f.newToday = false;
      reload();
    };
  });
  view.querySelector('[data-add]').onclick = () => openQuickAdd(ctx);
  view.querySelector('#city').onchange = (e) => { f.city = e.target.value; reload(); };
  view.querySelector('#sort').onchange = (e) => { f.sort = e.target.value; reload(); };
  const qi = view.querySelector('#q');
  let t;
  qi.oninput = () => { clearTimeout(t); t = setTimeout(() => { f.q = qi.value; offset = 0; load(); }, 400); };
  view.querySelector('#search-form').onsubmit = (e) => { e.preventDefault(); f.q = qi.value; qi.blur(); offset = 0; load(); };

  await load();
}

function row(l) {
  const contacts = [l.phone || l.whatsapp ? 'Phone' : '', l.email ? 'Email' : '', l.website ? 'Website' : '', l.instagram ? 'Instagram' : '', l.x_handle ? 'X' : '', l.telegram ? 'Telegram' : '', l.linkedin ? 'LinkedIn' : ''].filter(Boolean);
  return `<button class="row" data-lead="${l.id}">
    ${scoreChip(l.score)}
    <span class="row-main">
      <strong>${esc(l.name)}</strong>
      <span class="muted small">${esc([l.category, l.city].filter(Boolean).join(' · '))}${contacts.length ? ' · ' + esc(contacts.join(' · ')) : ' · no contact yet'}</span>
      <span class="tags">${brandTags(l.brand, true)}${statusTag(l.status)}</span>
    </span>
    ${icon('right', 'chev')}
  </button>`;
}
