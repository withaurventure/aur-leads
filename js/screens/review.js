// Review: possible duplicates side by side (Merge / Not the same), and recently merged leads (Undo).
import { rest, rpc, enc } from '../api.js';
import { esc, icon, pageHeader, toast, timeAgo, loading, emptyBox, confirmBox } from '../ui.js';

const SIDE = 'id,name,city,address,category,phone,whatsapp,email,website,instagram,source,status,first_seen_at,notes';

export async function renderReview(ctx, _p, view, alive) {
  view.innerHTML = `
    <header class="page-head plain"><div class="page-head-text"><h1>Review duplicates</h1><small>Checked every Sunday night</small></div></header>
    <div id="list">${loading()}</div>`;
  const [pairs, merged] = await Promise.all([
    rest(`duplicate_candidates?status=eq.pending&select=id,similarity,reason,a:leads!duplicate_candidates_lead_a_fkey(${SIDE}),b:leads!duplicate_candidates_lead_b_fkey(${SIDE})&order=similarity.desc.nullslast&limit=50`),
    rest('v_merged?select=id&limit=1000'),
  ]);
  if (!alive()) return;
  const list = view.querySelector('#list');
  const head = `<p class="info">Leads with the same phone, email, website or map listing are merged automatically. These look alike but need your call. A merge keeps all notes and history, and you can undo it.</p>`;
  const foot = `<button class="btn btn-ghost btn-block" data-merged>${icon('undo')}Recently merged (${merged.length}): see and undo</button>`;
  list.innerHTML = head + (pairs.length ? pairs.map(pair).join('') : emptyBox('Nothing to review. Nice and tidy.')) + foot;

  list.querySelector('[data-merged]').onclick = () => ctx.go('merged');
  list.querySelectorAll('[data-merge]').forEach((b) => {
    b.onclick = async () => {
      const p = pairs.find((x) => String(x.id) === b.dataset.merge);
      const [keep, drop] = pickKeep(p.a, p.b);
      b.disabled = true;
      try {
        await rpc('merge_leads', { p_keep: keep.id, p_drop: drop.id, p_reason: 'merged by you' });
        toast(`Merged into ${keep.name}`);
        ctx.rerender();
      } catch (e) { toast(e.message); b.disabled = false; }
    };
  });
  list.querySelectorAll('[data-notsame]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      try {
        await rest(`duplicate_candidates?id=eq.${enc(b.dataset.notsame)}`, { method: 'PATCH', body: { status: 'not_duplicate' } });
        toast('Kept apart');
        ctx.rerender();
      } catch (e) { toast(e.message); b.disabled = false; }
    };
  });
  list.querySelectorAll('[data-open]').forEach((el) => { el.onclick = () => ctx.go('lead', { id: el.dataset.open }); });
}

// keep the one you have already worked on, else the one with more contact details, else the older one
function pickKeep(a, b) {
  const worked = (x) => (x.status && x.status !== 'new' ? 1 : 0) + (x.notes ? 1 : 0);
  const info = (x) => ['phone', 'whatsapp', 'email', 'website', 'instagram'].filter((k) => x[k]).length;
  const sa = worked(a) * 10 + info(a), sb = worked(b) * 10 + info(b);
  if (sa !== sb) return sa > sb ? [a, b] : [b, a];
  return new Date(a.first_seen_at) <= new Date(b.first_seen_at) ? [a, b] : [b, a];
}

function side(x, label) {
  const line = (k, v) => `<div class="kv"><small>${k}</small><span>${v ? esc(v) : '<span class="muted">none</span>'}</span></div>`;
  return `<button class="dup-side" data-open="${x.id}" aria-label="Open ${esc(x.name)}">
    <small class="dup-label">${label}</small>
    <strong>${esc(x.name)}</strong>
    ${line('Area', x.address || x.city)}
    ${line('Phone', x.phone || x.whatsapp)}
    ${line('Email', x.email)}
    ${line('Website', x.website && x.website.replace(/^https?:\/\//, ''))}
    ${line('Found', timeAgo(x.first_seen_at))}
  </button>`;
}

function pair(p) {
  if (!p.a || !p.b) return '';
  const [keep] = pickKeep(p.a, p.b);
  return `<article class="card dup">
    <div class="dup-head"><span class="muted small">${esc(p.reason || 'Similar')}</span><span class="pill">${Math.round((p.similarity || 0) * 100)}% alike</span></div>
    <div class="dup-sides">${side(p.a, 'Lead A')}${side(p.b, 'Lead B')}</div>
    <p class="muted small">Merge keeps <strong>${esc(keep.name)}</strong> and adds the other's details to it.</p>
    <div class="two">
      <button class="btn btn-primary" data-merge="${p.id}">${icon('merge')}Merge</button>
      <button class="btn btn-ghost" data-notsame="${p.id}">Not the same</button>
    </div>
  </article>`;
}

export async function renderMerged(ctx, _p, view, alive) {
  view.innerHTML = pageHeader('Recently merged') + loading();
  const rows = await rest('v_merged?select=*&order=merged_at.desc&limit=50');
  if (!alive()) return;
  view.innerHTML = pageHeader('Recently merged', { sub: 'Undo puts a lead back on its own' }) +
    (rows.length ? `<div class="rows">${rows.map((r) => `
      <div class="row static">
        <span class="row-main"><strong>${esc(r.name)}</strong><span class="muted small">merged into ${esc(r.kept_name)} · ${esc(timeAgo(r.merged_at))}</span></span>
        <button class="btn btn-small" data-undo="${r.id}" data-name="${esc(r.name)}">${icon('undo')}Undo</button>
      </div>`).join('')}</div>` : emptyBox('No merges yet.'));
  view.querySelectorAll('[data-undo]').forEach((b) => {
    b.onclick = async () => {
      const ok = await confirmBox({ title: `Undo merge of ${b.dataset.name}?`, text: 'It becomes a separate lead again with its own contacts and history, and won\'t be suggested as a duplicate of this one again.', ok: 'Undo merge' });
      if (!ok) return;
      try { await rpc('unmerge_lead', { p_drop: b.dataset.undo }); toast('Merge undone'); ctx.rerender(); }
      catch (e) { toast(e.message); }
    };
  });
}
