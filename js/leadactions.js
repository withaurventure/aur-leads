// AUR Leads — things you do to a lead: change status, note a call or chat, log to its timeline.
import { rest, rpc, enc } from './api.js';
import { STATUS, digits } from './ui.js';

export const logEvent = (leadId, type, detail) =>
  rest('lead_events', { method: 'POST', body: { lead_id: leadId, type, detail } }).catch(() => {});

export async function updateLead(lead, patch, eventText) {
  await rest(`leads?id=eq.${enc(lead.id)}`, { method: 'PATCH', body: { ...patch, updated_at: new Date().toISOString() } });
  Object.assign(lead, patch);
  if (eventText) await logEvent(lead.id, 'you', eventText);
  if ('status' in patch || 'phone' in patch || 'email' in patch || 'website' in patch || 'instagram' in patch || 'whatsapp' in patch || 'x_handle' in patch || 'telegram' in patch || 'linkedin' in patch) {
    await rpc('apply_rule_score', { p_id: lead.id }).catch(() => {});
  }
}

export async function setStatus(lead, status) {
  if (lead.status === status) return;
  await updateLead(lead, { status }, `Status: ${STATUS[lead.status] || lead.status} → ${STATUS[status]}`);
}

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

// After a call / chat / email: a "new" lead becomes "contacted" with a follow-up in 3 days.
export async function noteContact(lead, how) {
  const patch = {};
  if (lead.status === 'new') patch.status = 'contacted';
  if (!lead.next_followup_at || new Date(lead.next_followup_at) < new Date()) patch.next_followup_at = inDays(3);
  if (Object.keys(patch).length) await updateLead(lead, patch);
  await logEvent(lead.id, 'you', how);
}

// After a pitch is shared: status → proposal sent (unless already further along), follow up in 3 days.
export async function notePitch(lead, brandName, channel) {
  const patch = { next_followup_at: inDays(3) };
  if (['new', 'contacted', 'replied', 'meeting'].includes(lead.status)) patch.status = 'proposal_sent';
  await updateLead(lead, patch);
  await logEvent(lead.id, 'pitch_sent', `${brandName} proposal sent by ${channel}`);
}

export const waNumber = (lead) => {
  const d = digits(lead.whatsapp || lead.phone);
  if (!d) return '';
  return d.length === 10 ? '91' + d : d;
};
export const waLink = (lead, text = '') => {
  const n = waNumber(lead);
  return n ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '';
};
export const telLink = (lead) => (lead.phone || lead.whatsapp ? `tel:${String(lead.phone || lead.whatsapp).replace(/[^\d+]/g, '')}` : '');
export const mailLink = (lead, subject = '', body = '') =>
  (lead.email ? `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : '');
export const webLink = (url) => (url ? (/^https?:\/\//i.test(url) ? url : 'http://' + url) : '');
