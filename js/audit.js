// Online presence audit: turns what we know about a lead (website checks, socials found, your quick
// tick-boxes) into a short, specific report. No AI: every line comes from a rule below, so it is
// always true for this lead and you can switch any finding off before sending.
import { AUDIT_URL } from './config.js';

const isWeb3 = (l) => l.segment === 'web3';
const isMedical = (l) => l.segment === 'medical';
const people = (l) => (isWeb3(l) ? 'users and investors' : isMedical(l) ? 'patients' : 'customers');
const short = (l) => String(l.name || '').replace(/[\s,]+(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|inc\.?|llp|llc)\s*$/i, '').trim() || l.name;
const host = (u) => { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, ''); } catch { return u; } };

// Things you check yourself in ~10 seconds (Instagram and Google do not let apps read these)
export const MANUAL = {
  local: [
    ['ig_inactive', 'Instagram: last post over a month ago'],
    ['ig_small', 'Instagram: under 500 followers'],
    ['ig_unbranded', 'Instagram: posts look mixed / unbranded'],
    ['few_reviews', 'Google: under 50 reviews'],
    ['reviews_unanswered', 'Google: reviews not replied to'],
    ['maps_incomplete', 'Google: missing photos, hours or services'],
  ],
  web3: [
    ['x_irregular', 'X: posts are irregular (gaps of a week or more)'],
    ['x_low_engagement', 'X: few replies or reposts on posts'],
    ['tg_quiet', 'Telegram: few messages or no admin replies'],
    ['no_announcements', 'No clear roadmap / announcements channel'],
  ],
};

// weight = how much it costs them (1 small … 3 serious)
function rules(l, m) {
  const a = l.site_audit || {};
  const P = people(l), N = short(l), city = l.city || 'your city';
  const year = new Date().getFullYear();
  const out = [];
  const add = (key, weight, title, detail, fix) => out.push({ key, weight, title, detail, fix });

  // website
  if (!l.website) {
    add('no_website', 3, 'No website',
      isWeb3(l) ? `We could not find a website for ${N}. Investors and users look for one before they trust a project.`
        : `When someone searches for ${N} or “${l.category || 'your service'} in ${city}”, there is no site showing your services, timings and location.`,
      'A fast one-page website with your services, timings, location and a WhatsApp button');
  } else if (l.website_ok === false || a.down) {
    add('site_down', 3, 'Your website is not opening',
      `${host(l.website)} did not load when we checked. Anyone who taps it from Google leaves straight away.`,
      'Get the site back online and keep it monitored');
  } else if (a.checked_at) {
    if (a.https === false) add('not_https', 2, 'Browsers mark your site “Not secure”',
      `Chrome shows a “Not secure” warning on ${host(l.website)} before ${P} even see the page.`, 'Switch the site to a secure (https) address');
    if (a.mobile === false) add('not_mobile', 2, 'Not built for phones',
      `Most ${P} visit from a phone, and your site does not adjust to small screens, so text is tiny and buttons are hard to tap.`, 'A mobile-first layout');
    if (a.load_ms && a.load_ms > 4000) add('slow', 1, `Slow to load (${(a.load_ms / 1000).toFixed(1)} seconds)`,
      `Your home page took ${(a.load_ms / 1000).toFixed(1)} seconds to load for us. Many mobile visitors give up after about 3.`, 'Lighter pages and images so it opens quickly');
    if (a.title_ok === false || a.description_ok === false) add('weak_preview', 1, 'Weak Google preview',
      `Your site is missing a clear page title or description, so Google shows a generic snippet instead of why ${P} should choose ${N}.`, 'Clear Google titles and descriptions for each service');
    if (!a.booking && !a.whatsapp_button) add('no_booking', 2, 'No easy way to enquire or book',
      `There is no booking form or WhatsApp button on your site, so every visitor has to find your number and call.`, 'A one-tap WhatsApp button and a simple enquiry form');
    if (a.copyright_year && a.copyright_year <= year - 2) add('outdated', 1, 'Site looks out of date',
      `The footer still says © ${a.copyright_year}. Visitors read that as a business that is not active online.`, 'Fresh content and an updated design');
    if (a.free_builder) add('free_builder', 1, 'Free website address',
      `Your site runs on a free builder address, which looks less established than your own domain.`, 'Move to your own .com or .in domain');
  }

  // socials
  if (isWeb3(l)) {
    if (!l.x_handle && !m.x_irregular && !m.x_low_engagement) add('no_x', 3, 'No X (Twitter) account found',
      `We could not find an X account for ${N}. In Web3, that is the first place people check whether a project is alive.`, 'An active X account with regular threads and updates');
    if (!l.telegram && !m.tg_quiet) add('no_telegram', 2, 'No Telegram community found',
      `There is no Telegram group linked for ${N}, so your community has no single place for news and questions.`, 'A moderated Telegram community with daily updates');
    if (m.x_irregular) add('x_irregular', 2, 'X posting is irregular', `There are gaps of a week or more between posts. Quiet accounts look inactive to new ${P}.`, 'A posting calendar: threads, updates and replies every week');
    if (m.x_low_engagement) add('x_low_engagement', 1, 'Low engagement on X', 'Posts get few replies or reposts, so they rarely reach new people.', 'Engagement-led content and KOL collaborations');
    if (m.tg_quiet) add('tg_quiet', 2, 'Telegram is quiet', 'The group has few messages and questions go unanswered. New members leave quickly.', 'Daily community management and moderation');
    if (m.no_announcements) add('no_announcements', 1, 'No clear announcements', 'There is no pinned roadmap or announcements channel, so people cannot see progress.', 'A clear roadmap post and regular progress updates');
  } else {
    const sawIg = m.ig_inactive || m.ig_small || m.ig_unbranded;   // you ticked an Instagram box, so they have one
    if (!l.instagram && !sawIg) add('no_instagram', 2, 'No Instagram found',
      `We could not find an Instagram account for ${N}. It is where ${P} in ${city} check your work, team and reviews before visiting.`, 'A branded Instagram page with weekly posts');
    if (!l.facebook && !l.instagram && !sawIg) add('no_facebook', 1, 'No Facebook page found',
      `There is no Facebook page either, which many ${P} still use to check timings and reviews.`, 'A Facebook page kept in step with Instagram');
    if (m.ig_inactive) add('ig_inactive', 2, 'Instagram has gone quiet', `The last post is over a month old. An inactive page makes ${P} wonder if you are still open.`, 'Regular posts every week, planned a month ahead');
    if (m.ig_small) add('ig_small', 1, 'Small Instagram audience', `Under 500 followers, so your posts reach very few people in ${city}.`, `Local reach: content and promotion aimed at ${city}`);
    if (m.ig_unbranded) add('ig_unbranded', 2, 'Posts do not look consistent', 'Mixed designs and colours make the page look unplanned. A consistent look builds trust.', 'A branded post design system');
    if (m.few_reviews) add('few_reviews', 2, 'Few Google reviews', `Under 50 reviews on Google. Most ${P} compare review counts before choosing.`, 'A simple system to ask happy customers for reviews');
    if (m.reviews_unanswered) add('reviews_unanswered', 1, 'Reviews go unanswered', 'Replying to reviews, especially unhappy ones, shows you care. Right now they get no reply.', 'Review replies handled for you');
    if (m.maps_incomplete) add('maps_incomplete', 1, 'Google listing is incomplete', 'Photos, hours or services are missing on Google Maps, so you lose people comparing options nearby.', 'A complete, regularly updated Google profile');
  }
  return out;
}

function positives(l) {
  const a = l.site_audit || {}, out = [];
  if (l.website && a.https && a.mobile) out.push('Your website is secure and works on phones');
  if (a.whatsapp_button || a.booking) out.push('Visitors can enquire directly from your site');
  if (a.ad_tracking) out.push('Your site already tracks visitors, so ads can be measured properly');
  if (isWeb3(l) ? l.x_handle : l.instagram) out.push(isWeb3(l) ? 'You have an X account to build on' : 'You have an Instagram page to build on');
  if (l.email) out.push('Your email is easy to find');
  return out.slice(0, 3);
}

// Build the audit. `off` = finding keys you switched off; `manual` = tick-box keys you ticked.
export function buildAudit(lead, cfg, { off = [], manual = [] } = {}) {
  const m = Object.fromEntries(manual.map((k) => [k, true]));
  const all = rules(lead, m);
  const findings = all.filter((f) => !off.includes(f.key)).sort((x, y) => y.weight - x.weight).slice(0, 5);
  const total = findings.reduce((s, f) => s + f.weight, 0);
  const score = Math.max(2, Math.min(9, Math.round(10 - total * 0.75)));
  const b = cfg.studio;
  return {
    v: 1,
    name: short(lead), category: lead.category || '', city: lead.city || '',
    segment: lead.segment, website: lead.website || '',
    score, findings: findings.map(({ key, title, detail, fix }) => ({ key, title, detail, fix })),
    positives: positives(lead),
    plan: [...new Set(findings.map((f) => f.fix))].slice(0, 4),
    checked_on: new Date().toISOString().slice(0, 10),
    from: { brand: b.name, person: cfg.sender, whatsapp: b.whatsapp, email: b.email, handle: b.handle, tagline: b.tagline },
    all_keys: all.map((f) => f.key),
  };
}

export const allFindings = (lead, manual = []) => rules(lead, Object.fromEntries(manual.map((k) => [k, true])));
export const auditLink = (token) => `${AUDIT_URL}?t=${token}`;

// Your audit choices per lead (ticks and switched-off findings), shared by the Audit and Send screens
export const auditPrefs = new Map();
export const prefsFor = (id) => {
  if (!auditPrefs.has(id)) auditPrefs.set(id, { off: new Set(), manual: new Set() });
  return auditPrefs.get(id);
};
export const newToken = () => (crypto.randomUUID ? crypto.randomUUID() + crypto.randomUUID() : String(Math.random()).slice(2) + Date.now() + String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 40);

export function whatsappText(lead, audit, link, cfg) {
  const top = audit.findings[0]?.title?.toLowerCase();
  const n = audit.findings.length;
  return `Hello ${audit.name} team, I'm ${cfg.sender} from ${cfg.studio.name}. `
    + `I did a quick check of ${audit.name}'s online presence and found ${n} ${n === 1 ? 'thing' : 'things'} that may be costing you ${people(lead)}`
    + (top ? `, starting with: ${top}.` : '.')
    + `\n\nHere is your free one-page audit: ${link}\n\nHappy to walk you through it in 10 minutes. Would that be useful?`;
}

export function emailContent(lead, audit, link, cfg) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const subject = `Free online audit for ${audit.name}`;
  const items = audit.findings.slice(0, 3);
  const text = `Hello ${audit.name} team,\n\nI'm ${cfg.sender} from ${cfg.studio.name}. I did a quick check of ${audit.name}'s online presence and scored it ${audit.score}/10. The main things holding it back:\n\n`
    + items.map((f, i) => `${i + 1}. ${f.title}: ${f.detail}`).join('\n')
    + `\n\nYour full one-page audit: ${link}\n\nIf useful, I can walk you through it in a 10-minute call this week.\n\n${cfg.sender}\n${cfg.studio.name} · ${cfg.studio.whatsapp} · ${cfg.studio.email}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1d2321;max-width:560px">
<p>Hello ${esc(audit.name)} team,</p>
<p>I'm ${esc(cfg.sender)} from ${esc(cfg.studio.name)}. I did a quick check of ${esc(audit.name)}'s online presence and scored it <b>${audit.score}/10</b>. The main things holding it back:</p>
<ol>${items.map((f) => `<li style="margin-bottom:8px"><b>${esc(f.title)}</b><br>${esc(f.detail)}</li>`).join('')}</ol>
<p><a href="${esc(link)}" style="display:inline-block;background:#2C2B6E;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">See your full audit</a></p>
<p>If useful, I can walk you through it in a 10-minute call this week.</p>
<p>${esc(cfg.sender)}<br>${esc(cfg.studio.name)} · ${esc(cfg.studio.whatsapp)} · ${esc(cfg.studio.email)}</p>
</div>`;
  return { subject, text, html };
}
