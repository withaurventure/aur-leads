// AUR Leads — the two brands a pitch can be sent as, and the editable pitch settings
// (services, contact lines, sender name), which are saved in Supabase → settings → pitch_config.
import { rest } from './api.js';

export const BRANDS = {
  studio: {
    id: 'studio',
    logo: 'logos/aur-studio.png',
    // colours read from your logo files
    primary: '#7C5BB3', dark: '#2C2B6E', soft: '#ECEAF5', accent: '#383495',
  },
  printing: {
    id: 'printing',
    logo: 'logos/aur-printing-studio.png',
    primary: '#344B9B', dark: '#1F3373', soft: '#E6ECFF', accent: '#5395D1',
  },
};

const DEFAULTS = {
  studio: {
    name: 'AUR Studio', tagline: 'Building Trust in a Trustless World',
    whatsapp: '+91 92784 33556', email: 'withaurstudio@gmail.com', handle: '@withaurstudio',
    services: [
      'Social media management | A steady, professional presence on Instagram and Facebook',
      'Google profile growth | More calls and visits from Google Search and Maps',
      'Performance marketing | Ad campaigns aimed at enquiries, managed and reported',
      'Community management | Replies, reviews and messages handled on time',
    ],
  },
  printing: {
    name: 'AUR Printing Studio', tagline: '',
    whatsapp: '+91 92784 33556', email: '', handle: '',
    services: [
      'Flex banners & hoardings | Indoor and outdoor, any size',
      'Posters & pamphlets | Bulk runs for campaigns and admissions',
      'Standees & signage | Reception, OPD, shop and event signage',
      'Visiting cards & letterheads | Consistent brand stationery',
      'Bulk forms & registers | Printed and bound to your format',
    ],
  },
  sender: 'Shashank Mishra',
};

let cached = null;
export async function pitchConfig(force = false) {
  if (cached && !force) return cached;
  try {
    const rows = await rest('settings?key=eq.pitch_config&select=value');
    const v = rows?.[0]?.value || {};
    cached = {
      studio: { ...DEFAULTS.studio, ...(v.studio || {}) },
      printing: { ...DEFAULTS.printing, ...(v.printing || {}) },
      sender: v.sender || DEFAULTS.sender,
    };
  } catch {
    cached = cached || structuredClone(DEFAULTS);
  }
  return cached;
}

export async function savePitchConfig(cfg) {
  const rows = await rest('settings?key=eq.pitch_config&select=key');
  if (rows.length) await rest('settings?key=eq.pitch_config', { method: 'PATCH', body: { value: cfg } });
  else await rest('settings', { method: 'POST', body: { key: 'pitch_config', value: cfg } });
  cached = cfg;
}

// "Title | description" → { title, text }
export const parseService = (s) => {
  const [title, ...rest] = String(s).split('|');
  return { title: title.trim(), text: rest.join('|').trim() };
};

// Which brand a lead is pitched as by default
export const defaultBrand = (lead) => (lead.brand === 'printing' ? 'printing' : 'studio');
