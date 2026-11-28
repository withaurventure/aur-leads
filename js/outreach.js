// Outreach drafts: the first message and its follow-ups, written for one lead, for WhatsApp and email.
// AUR Studio leads get their audit link; printing leads get items that fit their type of business.
import { whatsappText, emailContent } from './audit.js';

export const FOLLOWUP_DAYS = [3, 7];

const isStudio = (l) => l.segment === 'medical' || l.segment === 'web3' || l.brand === 'studio' || l.brand === 'both';
export const outreachBrand = (l) => (isStudio(l) ? 'studio' : 'printing');
const short = (l) => String(l.name || '').replace(/[\s,]+(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|inc\.?|llp|llc)\s*$/i, '').trim() || l.name;
const first = (s) => String(s || '').split(' ')[0];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const toHtml = (text) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1d2321;max-width:560px">${
  String(text).split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`).join('')}</div>`;
const OPT_OUT = 'If this is not relevant, just reply "no" and I will not write again.';

// What a printing buyer of this type usually orders
function printItems(l) {
  const t = `${l.category || ''} ${l.name || ''}`.toLowerCase();
  if (/school|vidyalaya|academy|public school|convent/.test(t)) return 'school diaries, ID cards, report cards and calendars';
  if (/coaching|institute|classes|tuition|career/.test(t)) return 'pamphlets, banners, brochures and admission forms';
  if (/college|university/.test(t)) return 'prospectus, ID cards, certificates and event banners';
  if (/hospital|clinic|diagnostic|pathology|nursing|medical|dental|lab/.test(t)) return 'prescription pads, letterheads, patient files and signage';
  if (/builder|developer|real estate|construction|properties|infra/.test(t)) return 'brochures, hoardings, site boards and flex banners';
  if (/party|election|samajwadi|bjp|congress|bsp|vidhayak|mla|neta/.test(t)) return 'posters, banners, flags, pamphlets and stickers';
  if (/hotel|restaurant|cafe|banquet|marriage|lawn|event/.test(t)) return 'menus, standees, banners and event branding';
  return 'visiting cards, letterheads, brochures and flex banners';
}

// steps[0] = first message, steps[1..] = follow-ups. Each: { day, wa, email: {subject, text, html, from_name} }
export function draftSteps(lead, cfg, audit, link) {
  const brand = outreachBrand(lead);
  const N = short(lead), me = cfg.sender, b = cfg[brand];
  const from_name = `${me} · ${b.name}`;
  const sign = `\n\n${me}\n${b.name} · ${b.whatsapp}${b.email ? ' · ' + b.email : ''}`;

  if (brand === 'studio' && audit && link && audit.findings.length) {
    const top = audit.findings[0], second = audit.findings[1] || audit.findings[0];
    const mail = emailContent(lead, audit, link, cfg);
    return [
      { day: 0, wa: whatsappText(lead, audit, link, cfg),
        email: { subject: mail.subject, text: mail.text + `\n\n${OPT_OUT}`, html: mail.html.replace(/<\/div>$/, `<p style="color:#6b7280;font-size:13px">${esc(OPT_OUT)}</p></div>`), from_name } },
      { day: FOLLOWUP_DAYS[0],
        wa: `Hi ${N} team, just checking you saw the audit I sent. The quickest win is: ${(second?.fix || 'a stronger online presence').toLowerCase()}. It usually takes us under a week.\n\nYour audit: ${link}\n\nShall I show you how in 10 minutes? ${first(me)}`,
        email: { subject: `Re: ${mail.subject}`, from_name,
          text: `Hello ${N} team,\n\nJust checking you saw the audit I sent. The quickest win for ${N} is: ${(second?.fix || 'a stronger online presence').toLowerCase()}. It usually takes us under a week to set up.\n\nYour audit again: ${link}\n\nWould a 10-minute call this week work?${sign}` } },
      { day: FOLLOWUP_DAYS[1],
        wa: `Hi ${N} team, last message from me. If fixing ${(top?.title || 'your online presence').toLowerCase()} is not a priority right now, no problem at all. If it is, reply "yes" and I will send a simple plan. ${first(me)}, ${b.name}`,
        email: { subject: `Re: ${mail.subject}`, from_name,
          text: `Hello ${N} team,\n\nThis is my last note. If improving ${(top?.title || 'your online presence').toLowerCase()} is not a priority right now, I understand completely.\n\nIf it is, just reply "yes" and I will send you a simple one-page plan with costs.${sign}` } },
    ].map(withHtml);
  }

  if (brand === 'studio') {      // no audit findings yet: a plain, short introduction
    const who = lead.segment === 'web3' ? 'Web3 teams' : lead.segment === 'medical' ? 'clinics and hospitals' : 'local businesses';
    const what = lead.segment === 'web3' ? 'grow an active community on X and Telegram' : 'get more enquiries from Instagram and Google';
    const subject = `${N}: more enquiries online`;
    return [
      { day: 0,
        wa: `Hello ${N} team, I'm ${me} from ${b.name}. We help ${who} ${what}. I had a look at ${N} online and have 2-3 quick ideas for you.\n\nWould a 10-minute call this week be useful?`,
        email: { subject, from_name,
          text: `Hello ${N} team,\n\nI'm ${me} from ${b.name}. We help ${who} ${what}. I had a look at ${N} online and have 2-3 quick ideas that could bring you more enquiries.\n\nWould a 10-minute call this week be useful?\n\n${OPT_OUT}${sign}` } },
      { day: FOLLOWUP_DAYS[0],
        wa: `Hi ${N} team, just following up. Happy to share those ideas on WhatsApp if a call is hard to fit in. ${first(me)}`,
        email: { subject: `Re: ${subject}`, from_name, text: `Hello ${N} team,\n\nJust following up. If a call is hard to fit in, I am happy to send the ideas by email instead. Shall I?${sign}` } },
      { day: FOLLOWUP_DAYS[1],
        wa: `Hi ${N} team, last message from me. If growing online is not a priority right now, no problem. Reply "yes" any time and I will send a simple plan. ${first(me)}, ${b.name}`,
        email: { subject: `Re: ${subject}`, from_name, text: `Hello ${N} team,\n\nThis is my last note. If growing online is not a priority right now, I understand. Reply "yes" any time and I will send a simple plan with costs.${sign}` } },
    ].map(withHtml);
  }

  // AUR Printing Studio
  const items = printItems(lead);
  const subject = `Bulk printing for ${N}`;
  return [
    { day: 0,
      wa: `Hello ${N} team, I'm ${me} from ${b.name}, Prayagraj. We print in bulk for businesses like yours: ${items}, with delivery across UP.\n\nCan I send you our rates for your next order?`,
      email: { subject, from_name,
        text: `Hello ${N} team,\n\nI'm ${me} from ${b.name}, Prayagraj. We handle bulk printing for businesses like yours: ${items}, with delivery across UP.\n\nIf you have an order coming up, reply with the item and quantity and I will send a quote the same day.\n\n${OPT_OUT}${sign}` } },
    { day: FOLLOWUP_DAYS[0],
      wa: `Hi ${N} team, following up on printing. If anything is coming up (${items}), send me the item and quantity and I will share a quote the same day. ${first(me)}`,
      email: { subject: `Re: ${subject}`, from_name,
        text: `Hello ${N} team,\n\nFollowing up on my note about printing. If you have anything coming up (${items}), send me the item and quantity and I will share a quote the same day.${sign}` } },
    { day: FOLLOWUP_DAYS[1],
      wa: `Hi ${N} team, last message from me. Save this number for your next printing order, and you will get a quote within the day. ${first(me)}, ${b.name}`,
      email: { subject: `Re: ${subject}`, from_name,
        text: `Hello ${N} team,\n\nThis is my last note. Please keep my number for your next printing order: ${b.whatsapp}. You will get a quote within the day.${sign}` } },
  ].map(withHtml);
}

function withHtml(s) {
  if (s.email && !s.email.html) s.email.html = toHtml(s.email.text);
  return s;
}
