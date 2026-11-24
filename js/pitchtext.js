// AUR Leads — the starting words of a pitch, built from what the agent found about the lead.
// Everything here is only a first draft: the Pitch screen lets you edit it before sending.

const EDU = /coaching|school|college|education/i;
const MED = /hospital|clinic|dental|diagnostic|lab|ivf|eye|skin|physio|ortho|gyn|maternity|ayur|homeo|pharmacy|children/i;

function audience(lead) {
  if (lead.segment === 'medical' || MED.test(lead.category || '')) return 'patients';
  if (EDU.test(lead.category || '')) return 'students and parents';
  if (lead.segment === 'election') return 'voters';
  return 'customers';
}

function printNeeds(lead) {
  const c = (lead.category || '').toLowerCase();
  if (lead.segment === 'election' || c.includes('party')) return 'campaign banners, posters, pamphlets and flags';
  if (MED.test(c)) return 'signage, OPD forms, patient files and awareness banners';
  if (EDU.test(c)) return 'admission banners, pamphlets, standees and ID cards';
  if (c.includes('real estate')) return 'hoardings, site banners and brochures';
  if (c.includes('event') || c.includes('banquet')) return 'event backdrops, standees and banners';
  if (c.includes('hotel')) return 'menus, standees, signage and offer banners';
  if (c.includes('showroom') || c.includes('jewel')) return 'offer banners, standees and brochures';
  if (c.includes('distributor') || c.includes('trader')) return 'shop branding, product posters and order books';
  return 'banners, posters and printed stationery';
}

// "Kalp Labs Pvt Ltd" → "Kalp Labs" in letters
const nice = (lead) => String(lead.name || '').replace(/[\s,]+(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|inc\.?|llp|llc)\s*$/i, '').trim() || lead.name;
const where = (lead) => (lead.city ? ` in ${lead.city}` : '');

export function draftIntro(lead, brand, cfg) {
  const b = cfg[brand];
  if (brand === 'printing') {
    return `Hello ${nice(lead)} team,\n\nI'm ${cfg.sender} from ${b.name}. We handle printing for organisations${where(lead)}, from flex banners and hoardings to bulk forms. Here is a short note on how we can help ${nice(lead)}.`;
  }
  if (lead.segment === 'web3') {
    return `Hello ${nice(lead)} team,\n\nI'm ${cfg.sender} from ${b.name}. We help Web3 teams grow an active community on X and Telegram, so more users and investors notice and trust the project. Here is a short proposal based on what we found about ${nice(lead)} online.`;
  }
  return `Hello ${nice(lead)} team,\n\nI'm ${cfg.sender} from ${b.name}. We help businesses${where(lead)} build trust online, so more ${audience(lead)} find and choose them. Here is a short proposal based on what we found about ${nice(lead)} online.`;
}

export function draftNotes(lead, brand) {
  const out = [];
  if (brand === 'printing') {
    out.push(`As a ${lead.category || 'business'}${where(lead)}, you likely need ${printNeeds(lead)} regularly.`);
    out.push('We take care of design, printing and delivery, so you deal with one team for everything.');
    out.push('Bulk orders are planned to your dates, with a proof for you to approve before printing.');
    return out;
  }
  if (lead.segment === 'web3') return web3Notes(lead);
  const who = audience(lead);
  if (!lead.website) out.push(`We could not find a website for ${nice(lead)}. ${who[0].toUpperCase() + who.slice(1)} who search online may not find you.`);
  else if (lead.website_ok === false) out.push('Your website did not open when we checked it, so visitors may be leaving.');
  if (lead.instagram) out.push(`You have an Instagram page (@${lead.instagram}). Regular, planned posts can turn it into a steady source of enquiries.`);
  else if (lead.enrich_status) out.push(`We could not find an active Instagram page for ${nice(lead)}.`);
  if (!lead.phone && !lead.whatsapp) out.push('Your phone number is hard to find online, so some enquiries may never reach you.');
  out.push(`Most ${who}${where(lead)} check Google and Instagram before they decide. A clear, active presence builds trust.`);
  return out.slice(0, 4);
}

function web3Notes(lead) {
  const out = [];
  const h = lead.meta?.hiring;
  if (h?.marketing && h.marketing_title) out.push(`We saw you are hiring a ${h.marketing_title}. While you hire, we can run your content and community so growth does not pause.`);
  if (lead.x_handle) out.push(`Your X account (@${lead.x_handle}) is where users and investors judge a project first. Regular threads, launch posts and replies turn followers into users.`);
  else out.push(`We could not find an active X account for ${nice(lead)}. In Web3, that is usually the first place people check.`);
  if (lead.telegram) out.push(`Your Telegram (@${lead.telegram}) needs daily updates and quick answers to stay active and trusted.`);
  else out.push('A well-run Telegram group gives your community one place to ask questions and hear news first.');
  out.push('We plan content calendars, launch campaigns, graphics and KOL outreach, so your team stays focused on building.');
  return out.slice(0, 4);
}

export function draftMessage(lead, brand, cfg) {
  const b = cfg[brand];
  return `Hello ${nice(lead)} team, this is ${cfg.sender} from ${b.name}. I've attached a short proposal for ${nice(lead)}. Could we have a quick 10-minute call this week?`;
}

export const emailSubject = (lead, brand, cfg) => `Proposal for ${nice(lead)} · ${cfg[brand].name}`;
