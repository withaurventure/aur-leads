// Tenders (AUR Printing): open bids from your tender-alert emails, with fit score, value and deadline.
import { rest, enc } from '../api.js';
import { esc, icon, scoreChip, inrShort, fmtDate, toast, loading, emptyBox } from '../ui.js';
import { webLink } from '../leadactions.js';

const STATUS = { new: 'New', watching: 'Watching', partner_bid: 'Partner bid', bidding: 'Bidding', submitted: 'Submitted', won: 'Won', lost: 'Lost', skipped: 'Skipped', expired: 'Expired' };

export async function renderTenders(ctx, _p, view, alive) {
  const tab = ctx.state.tenderTab;
  const now = enc(new Date().toISOString());
  const filter = {
    open: `status=in.(new,watching,partner_bid,bidding)&and=(or(end_at.is.null,end_at.gt.${now}),or(fit_score.is.null,fit_score.gte.4))&order=fit_score.desc.nullslast,end_at.asc.nullslast`,
    low: `status=eq.new&fit_score=lte.3&or=(end_at.is.null,end_at.gt.${now})&order=end_at.asc.nullslast`,
    mine: 'status=in.(watching,partner_bid,bidding,submitted)&order=end_at.asc.nullslast',
    results: 'or=(awarded_to.not.is.null,status.in.(won,lost,expired,skipped))&order=updated_at.desc',
  }[tab];
  const seg = (v, l) => `<button class="chip" aria-pressed="${tab === v}" data-tab="${v}">${l}</button>`;
  view.innerHTML = `
    <header class="page-head plain"><div class="page-head-text"><h1>Tenders</h1><small>AUR Printing Studio</small></div></header>
    <p class="info">Tenders arrive from your tender alert emails. Fit score looks at value, place, deadline and whether a new small business or startup may bid.</p>
    <div class="chips">${seg('open', 'Open')}${seg('mine', 'Mine')}${seg('results', 'Results &amp; winners')}${seg('low', 'Low fit')}</div>
    <div id="list">${loading()}</div>`;
  view.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { ctx.state.tenderTab = b.dataset.tab; ctx.rerender(); }; });

  const rows = await rest(`tenders?select=*&${filter}&limit=100`);
  if (!alive()) return;
  const list = view.querySelector('#list');
  if (!rows.length) {
    list.innerHTML = emptyBox(tab === 'open'
      ? 'No open tenders yet. Once tender alerts reach withaurventure@gmail.com, the agent will list them here.'
      : 'Nothing here yet.');
    return;
  }
  list.innerHTML = rows.map(card).join('');
  list.querySelectorAll('[data-status]').forEach((sel) => {
    sel.onchange = async () => {
      try {
        await rest(`tenders?id=eq.${enc(sel.dataset.status)}`, { method: 'PATCH', body: { status: sel.value, updated_at: new Date().toISOString() } });
        toast(`Marked ${STATUS[sel.value]}`);
      } catch (e) { toast(e.message); }
    };
  });
}

function card(t) {
  const days = t.end_at ? Math.ceil((new Date(t.end_at) - Date.now()) / 86400000) : null;
  const dl = days == null ? 'No deadline given' : days < 0 ? `Closed ${fmtDate(t.end_at)}` : days === 0 ? 'Closes today' : `Closes in ${days} day${days === 1 ? '' : 's'}`;
  const urgent = days != null && days >= 0 && days <= 7;
  const badges = [
    t.mse_relaxation && 'MSE relaxation', t.startup_relaxation && 'Startup relaxation',
    t.quantity && `Qty ${Number(t.quantity).toLocaleString('en-IN')}`, t.portal && t.portal.toUpperCase(),
  ].filter(Boolean);
  return `<article class="card tender">
    <div class="tender-top">
      ${scoreChip(t.fit_score)}
      <div><h2>${esc(t.title || t.bid_number)}</h2><p class="muted small">${esc([t.buyer_org, t.city || t.state].filter(Boolean).join(' · '))}</p><p class="muted small">${esc(t.bid_number)}</p></div>
    </div>
    <div class="tender-mid">
      <div><small class="muted">Est. value</small><strong class="big-num">${esc(inrShort(t.est_value_inr))}</strong></div>
      <span class="deadline${urgent ? ' urgent' : ''}">${icon('clock', 'inline')}${esc(dl)}</span>
    </div>
    ${t.awarded_to ? `<p class="small"><strong>Won by:</strong> ${esc(t.awarded_to)}${t.awarded_value_inr ? ` at ${esc(inrShort(t.awarded_value_inr))}` : ''}</p>` : ''}
    ${t.fit_reason ? `<p class="muted small">${esc(t.fit_reason)}</p>` : ''}
    ${badges.length ? `<div class="tags">${badges.map((b) => `<span class="tag tag-plain">${esc(b)}</span>`).join('')}</div>` : ''}
    <div class="two">
      <label class="select-wrap"><span class="sr-only">Status</span>
        <select data-status="${t.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>
      ${t.url || t.email_link ? `<a class="btn btn-primary" href="${esc(webLink(t.url || t.email_link))}" target="_blank" rel="noopener">${/mail\.google\./.test(t.url || t.email_link) ? 'Open alert email' : 'Open bid'}</a>` : ''}
    </div>
  </article>`;
}
