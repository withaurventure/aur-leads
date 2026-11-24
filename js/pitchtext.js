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

const nice = (lead) => lead.name;
const where = (lead) => (lead.city ? ` in ${lead.city}` : '');

export function draftIntro(lead, brand, cfg) {
  const b = cfg[brand];
  if (brand === 'printing') {
    return `Hello ${nice(lead)} team,\n\nI'm ${cfg.sender} from ${b.name}. We handle printing for organisations${where(lead)}, from flex banners and hoardings to bulk forms. Here is a short note on how we can help ${nice(lead)}.`;
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
  const who = audience(lead);
  if (!lead.website) out.push(`We could not find a website for ${nice(lead)}. ${who[0].toUpperCase() + who.slice(1)} who search online may not find you.`);
  else if (lead.website_ok === false) out.push('Your website did not open when we checked it, so visitors may be leaving.');
  if (lead.instagram) out.push(`You have an Instagram page (@${lead.instagram}). Regular, planned posts can turn it into a steady source of enquiries.`);
  else if (lead.enrich_status) out.push(`We could not find an active Instagram page for ${nice(lead)}.`);
  if (!lead.phone && !lead.whatsapp) out.push('Your phone number is hard to find online, so some enquiries may never reach you.');
  out.push(`Most ${who}${where(lead)} check Google and Instagram before they decide. A clear, active presence builds trust.`);
  return out.slice(0, 4);
}

export function draftMessage(lead, brand, cfg) {
  const b = cfg[brand];
  return `Hello ${nice(lead)} team, this is ${cfg.sender} from ${b.name}. I've attached a short proposal for ${nice(lead)}. Could we have a quick 10-minute call this week?`;
}

export const emailSubject = (lead, brand, cfg) => `Proposal for ${nice(lead)} · ${cfg[brand].name}`;
