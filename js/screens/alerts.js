// Alerts: everything the agent told you about, newest first (the same alerts that reach your phone).
import { rest, rpc } from '../api.js';
import { esc, icon, pageHeader, timeAgo, loading, emptyBox } from '../ui.js';

const KIND = {
  reply: ['Reply', 'whatsapp'], audit: ['Audit opened', 'eye'], followup: ['Follow-ups', 'share'], tender: ['Tender', 'tender'],
  summary: ['Summary', 'home'], problem: ['Problem', 'ban'], test: ['Test', 'check'],
};

export function openTarget(ctx, url) {
  if (!url || url === 'home') return ctx.tab('home');
  if (url === 'tenders') return ctx.tab('tenders');
  if (url.startsWith('lead:')) return ctx.go('lead', { id: url.slice(5) });
  return ctx.tab('home');
}

export async function renderAlerts(ctx, _p, view, alive) {
  view.innerHTML = pageHeader('Alerts') + loading();
  const rows = await rest('notifications?select=id,kind,title,body,url,created_at,read_at&order=created_at.desc&limit=60');
  if (!alive()) return;
  view.innerHTML = `${pageHeader('Alerts', { sub: 'Also sent to your phone when alerts are on (Settings)' })}
    ${rows.length ? `<div class="rows">${rows.map((a) => {
      const [label, ic] = KIND[a.kind] || [a.kind, 'check'];
      return `<button class="row alert-row ${a.read_at ? '' : 'unread'} kind-${esc(a.kind)}" data-url="${esc(a.url || 'home')}">
        <span class="alert-ic">${icon(ic)}</span>
        <span class="row-main"><strong>${esc(a.title)}</strong>
          ${a.body ? `<span class="small">${esc(a.body)}</span>` : ''}
          <span class="muted small">${esc(label)} · ${esc(timeAgo(a.created_at))}</span></span>
        ${icon('right', 'chev')}</button>`;
    }).join('')}</div>` : emptyBox('No alerts yet. Replies, audit opens, follow-ups and problems will show here.')}`;
  view.querySelectorAll('[data-url]').forEach((b) => { b.onclick = () => openTarget(ctx, b.dataset.url); });
  if (rows.some((a) => !a.read_at)) rpc('read_alerts').catch(() => {});
}
