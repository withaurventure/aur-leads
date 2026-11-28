// Contacted: everyone you have messaged, grouped by where they stand. They no longer show in Leads.
import { rest, rpc, q, enc } from '../api.js';
import { esc, icon, num, timeAgo, scoreChip, loading, emptyBox } from '../ui.js';

const STAGES = [
  ['', 'All'], ['replied', 'Replied'], ['waiting', 'Waiting for reply'], ['no_reply', 'No reply'],
  ['meeting', 'Meeting'], ['proposal', 'Proposal sent'], ['won', 'Won'], ['lost', 'Lost'],
];
const LABEL = Object.fromEntries(STAGES);
const PAGE = 40;
const day = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function line(l) {
  if (l.stage === 'replied') return `Replied${l.replied_via ? ' by ' + l.replied_via : ''} ${l.replied_at ? timeAgo(l.replied_at) : ''}${l.reply_snippet ? ': “' + l.reply_snippet.slice(0, 80) + '”' : ''}`;
  if (l.stage === 'waiting') {
    if (l.o_state === 'active' && l.wa_pending_step != null) return `WhatsApp follow-up ${l.wa_pending_step} ready to send`;
    if (l.o_state === 'active') return `Messaged ${day(l.messaged_at)} · follow-up ${l.current_step + 1} on ${day(l.next_step_at)}`;
    return l.messaged_at ? `Messaged ${day(l.messaged_at)}` : `Contacted${l.last_event_at ? ' ' + timeAgo(l.last_event_at) : ''}`;
  }
  if (l.stage === 'no_reply') return `No reply${l.messaged_at ? ' · messaged ' + day(l.messaged_at) : ''}`;
  return l.last_event_at ? `Last activity ${timeAgo(l.last_event_at)}` : '';
}

export async function renderContacted(ctx, _p, view, alive) {
  const f = (ctx.state.contacted ||= { stage: '', q: '' });
  view.innerHTML = loading();
  const counts = await rpc('pipeline_counts').catch(() => ({}));
  if (!alive()) return;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  view.innerHTML = `
    <header class="page-head plain"><div class="page-head-text"><h1>Contacted</h1><small>${num(total)} ${total === 1 ? 'lead' : 'leads'} you have reached out to</small></div></header>
    <form class="search" role="search" id="c-search">${icon('search')}
      <label class="sr-only" for="cq">Search contacted leads</label>
      <input id="cq" type="search" placeholder="Search name, phone, city" value="${esc(f.q)}" enterkeyhint="search" autocomplete="off"></form>
    <div class="chips" aria-label="Stage">
      ${STAGES.filter(([k]) => !k || counts[k]).map(([k, label]) => `<button class="chip stage-${k || 'all'}" aria-pressed="${f.stage === k}" data-stage="${k}">${esc(label)} <b>${num(k ? counts[k] : total)}</b></button>`).join('')}
    </div>
    <div id="rows" class="rows">${loading()}</div>
    <div id="more"></div>`;

  let offset = 0, rows = [];
  const query = () => {
    const p = ['select=*'];
    if (f.stage) p.push(`stage=eq.${f.stage}`);
    const t = (f.q || '').trim();
    if (t) { const v = q(`*${t}*`); p.push(`or=(${enc(`name.ilike.${v},phone.ilike.${v},city.ilike.${v},email.ilike.${v}`)})`); }
    p.push('order=stage_rank.asc,replied_at.desc.nullslast,next_step_at.asc.nullslast,last_event_at.desc.nullslast', `limit=${PAGE}`, `offset=${offset}`);
    return 'v_pipeline?' + p.join('&');
  };
  async function load(append = false) {
    const res = await rest(query(), { count: true });
    if (!alive()) return;
    rows = append ? rows.concat(res.rows) : res.rows;
    const box = view.querySelector('#rows');
    box.innerHTML = rows.length ? rows.map((l) => `
      <button class="row" data-lead="${l.id}">
        ${scoreChip(l.score)}
        <span class="row-main">
          <strong>${esc(l.name)}</strong>
          <span class="muted small">${esc(line(l))}</span>
          <span class="tags"><span class="tag stage-tag stage-${esc(l.stage)}">${esc(LABEL[l.stage] || l.stage)}</span>${l.city ? `<span class="tag tag-plain">${esc(l.city)}</span>` : ''}</span>
        </span>${icon('right', 'chev')}
      </button>`).join('')
      : emptyBox(total ? 'Nobody in this group.' : 'Nobody contacted yet. Open a lead and tap Message: it moves here.');
    const more = view.querySelector('#more');
    more.innerHTML = rows.length < res.total ? `<button class="btn btn-ghost btn-block" data-more>Show more (${num(res.total - rows.length)} left)</button>` : '';
    const m = more.querySelector('[data-more]');
    if (m) m.onclick = async () => { m.disabled = true; offset += PAGE; await load(true); };
    box.querySelectorAll('[data-lead]').forEach((el) => { el.onclick = () => ctx.go('lead', { id: el.dataset.lead }); });
  }
  view.querySelectorAll('[data-stage]').forEach((b) => { b.onclick = () => { f.stage = b.dataset.stage; ctx.rerender(); }; });
  let timer;
  view.querySelector('#cq').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { f.q = e.target.value; offset = 0; load(); }, 350); };
  view.querySelector('#c-search').onsubmit = (e) => { e.preventDefault(); f.q = view.querySelector('#cq').value; offset = 0; load(); };
  await load();
}
