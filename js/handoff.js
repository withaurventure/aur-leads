// AUR Leads → AUR Desk: when a lead is won, add it to AUR Desk's client list on this phone.
// Both apps live on withaurventure.github.io, so they share this phone's storage for that site.
// We only ever ADD one client record, in the exact shape AUR Desk's own form saves.
// If AUR Desk has never been opened on this phone, nothing is created.

const CHECKLISTS = {
  studio: ['Kick-off call done', 'Services agreed', 'Quotation accepted', 'Advance payment received', 'Brand assets received (logo, colours, photos)', 'Account access shared', 'Content plan approved', 'Live: first post published'],
  printing: ['Requirement noted (item, size, quantity)', 'Design / artwork approved', 'Quotation accepted', 'Advance payment received', 'Printing done', 'Delivered / installed'],
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const last10 = (s) => String(s || '').replace(/\D/g, '').slice(-10);

function niche(lead) {
  const c = `${lead.segment} ${lead.category}`.toLowerCase();
  if (lead.segment === 'medical' || /hospital|clinic|dental|diagnostic|lab|ivf|pharmacy/.test(c)) return 'Medical / clinic';
  if (lead.segment === 'web3') return 'Web3 / crypto';
  if (/coaching|school|college|education/.test(c)) return 'Education';
  if (/real estate/.test(c)) return 'Real estate';
  if (/showroom|jewel|retail|shop/.test(c)) return 'Retail / shop';
  if (/hotel|restaurant|food/.test(c)) return 'Restaurant / food';
  return 'Other';
}

function openDesk() {
  return new Promise((resolve) => {
    const req = indexedDB.open('aur-desk');
    req.onupgradeneeded = () => { req.transaction.abort(); };   // AUR Desk not set up here: create nothing
    req.onsuccess = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('clients')) { d.close(); resolve(null); return; }
      resolve(d);
    };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

// → { ok: true, id } | { ok: false, reason: 'no-desk' | 'exists', name }
export async function sendToDesk(lead, brand) {
  const d = await openDesk();
  if (!d) return { ok: false, reason: 'no-desk' };
  try {
    const all = await new Promise((resolve, reject) => {
      const r = d.transaction('clients', 'readonly').objectStore('clients').getAll();
      r.onsuccess = () => resolve(r.result || []); r.onerror = () => reject(r.error);
    });
    const company = brand === 'printing' ? 'printing' : 'studio';
    const phone = lead.whatsapp || lead.phone || '';
    const dup = all.find((c) => c.company === company && (
      (phone && last10(c.phone) && last10(c.phone) === last10(phone)) ||
      c.name.trim().toLowerCase() === lead.name.trim().toLowerCase()));
    if (dup) return { ok: false, reason: 'exists', name: dup.name };

    const now = new Date().toISOString();
    const notes = [
      `From AUR Leads: ${lead.category || 'lead'}, score ${lead.score ?? '–'}/10.`,
      lead.website && `Website: ${lead.website}`,
      lead.instagram && `Instagram: @${lead.instagram}`,
      lead.address && `Address: ${lead.address}`,
      lead.notes,
    ].filter(Boolean).join('\n');
    const record = {
      id: uid(), company,
      name: lead.name, contact: '', phone, email: lead.email || '',
      prefers: phone ? 'whatsapp' : (lead.email ? 'email' : 'whatsapp'),
      market: (lead.city || '').toLowerCase() === 'prayagraj' ? 'prayagraj' : 'india',
      city: lead.city || '', country: 'India', niche: niche(lead), notes,
      checklist: CHECKLISTS[company].map((label) => ({ label, done: false, at: null })),
      createdAt: now, updatedAt: now,
      source: 'aur-leads', leadId: lead.id,
    };
    await new Promise((resolve, reject) => {
      const t = d.transaction('clients', 'readwrite');
      t.objectStore('clients').put(record);
      t.oncomplete = resolve; t.onerror = () => reject(t.error);
    });
    return { ok: true, id: record.id };
  } finally {
    d.close();
  }
}

export const DESK_URL = '../aur-desk/';
