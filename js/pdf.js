// AUR Leads — branded A4 pitch PDFs for AUR Studio and AUR Printing Studio.
// Runs fully on the phone (jsPDF + Montserrat, the same engine as AUR Desk). No prices, ever.
import { BRANDS, parseService } from './brands.js';

let libPromise;
function loadLib() {
  if (!libPromise) {
    libPromise = (async () => {
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'vendor/jspdf.umd.min.js'; s.onload = resolve; s.onerror = () => reject(new Error('PDF engine failed to load'));
          document.head.appendChild(s);
        });
      }
      const fonts = {};
      for (const w of ['Regular', 'SemiBold', 'Bold']) fonts[w] = await fileToBase64(`fonts/Montserrat-${w}.ttf`);
      return { jsPDF: window.jspdf.jsPDF, fonts };
    })();
    libPromise.catch(() => { libPromise = null; });
  }
  return libPromise;
}

async function fileToBase64(url) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Logo → small JPEG on white (keeps the PDF light enough for WhatsApp)
async function loadImage(url, maxPx = 360) {
  const blob = await (await fetch(url)).blob();
  const src = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; });
  const k = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) });
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  const px = g.getImageData(0, 0, c.width, c.height);   // near-white logo backgrounds → pure white
  for (let i = 0; i < px.data.length; i += 4) {
    if (px.data[i] > 244 && px.data[i + 1] > 244 && px.data[i + 2] > 244) { px.data[i] = px.data[i + 1] = px.data[i + 2] = 255; }
  }
  g.putImageData(px, 0, 0);
  return { dataUrl: c.toDataURL('image/jpeg', 0.9), w: c.width, h: c.height };
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/* pitch = { brand, lead, cfg, intro, notes[], services[] (raw "Title | text"), date } */
export async function buildPitchPdf(pitch) {
  const { jsPDF, fonts } = await loadLib();
  const B = BRANDS[pitch.brand];
  const b = pitch.cfg[pitch.brand];
  const PRIMARY = rgb(B.primary), DARK = rgb(B.dark), SOFT = rgb(B.soft);
  const INK = [33, 37, 52], SLATE = [86, 94, 116];
  const W = 210, L = 18, R = 192, BOTTOM = 268;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (const [w, data] of Object.entries(fonts)) { pdf.addFileToVFS(`M-${w}.ttf`, data); pdf.addFont(`M-${w}.ttf`, 'M', w.toLowerCase()); }
  const font = (w, size, color = INK) => { pdf.setFont('M', w); pdf.setFontSize(size); pdf.setTextColor(...color); };
  const lh = (size) => size * 0.42;   // line height in mm for a font size

  let y = 0;
  const newPage = () => { footer(); pdf.addPage(); y = 20; band(); };
  const need = (h) => { if (y + h > BOTTOM) newPage(); };
  const band = () => { pdf.setFillColor(...PRIMARY); pdf.rect(0, 0, W, 5, 'F'); };

  function para(text, size = 10.5, color = INK, width = R - L, x = L) {
    font('regular', size, color);
    for (const block of String(text).split('\n')) {
      if (!block.trim()) { y += lh(size) * 0.7; continue; }
      for (const line of pdf.splitTextToSize(block, width)) { need(lh(size)); pdf.text(line, x, y); y += lh(size); }
    }
  }
  function heading(text) {
    need(16);
    y += 4;
    font('bold', 9, PRIMARY);
    pdf.text(text.toUpperCase(), L, y, { charSpace: 0.6 });
    y += 2.5;
    pdf.setDrawColor(...PRIMARY); pdf.setLineWidth(0.5); pdf.line(L, y, L + 14, y);
    y += 6;
  }
  function footer() {
    const fy = 284;
    pdf.setDrawColor(225, 228, 236); pdf.setLineWidth(0.3); pdf.line(L, fy - 6, R, fy - 6);
    font('semibold', 9, DARK); pdf.text(b.name, L, fy);
    const contact = [b.whatsapp && `WhatsApp ${b.whatsapp}`, b.email, b.handle].filter(Boolean).join('   ·   ');
    font('regular', 8.5, SLATE); pdf.text(contact, R, fy, { align: 'right' });
    if (b.tagline) { font('regular', 8, PRIMARY); pdf.text(b.tagline, L, fy + 4.5); }
  }

  /* ---- header ---- */
  band();
  y = 16;
  let logoH = 0;
  try {
    const logo = await loadImage(B.logo);
    const box = 34, ratio = logo.w / logo.h;
    const w = ratio >= 1 ? box : box * ratio, h = ratio >= 1 ? box / ratio : box;
    pdf.addImage(logo.dataUrl, 'JPEG', L - 2, y - 4, w, h);
    logoH = h;
  } catch { /* logo is optional */ }
  font('bold', 9, PRIMARY); pdf.text('PROPOSAL', R, y + 2, { align: 'right', charSpace: 0.8 });
  font('regular', 9, SLATE); pdf.text(pitch.date, R, y + 7.5, { align: 'right' });
  font('regular', 9, SLATE); pdf.text('Prepared for', R, y + 16, { align: 'right' });
  font('semibold', 11, INK);
  const forLines = pdf.splitTextToSize(pitch.lead.name, 80);
  forLines.slice(0, 2).forEach((l, i) => pdf.text(l, R, y + 21.5 + i * 5, { align: 'right' }));
  y = Math.max(y + logoH, y + 30) + 6;

  /* ---- title ---- */
  const title = pitch.brand === 'printing'
    ? `Print support for ${pitch.lead.name}`
    : `Helping ${pitch.lead.name} grow online`;
  font('bold', 19, DARK);
  for (const line of pdf.splitTextToSize(title, R - L)) { pdf.text(line, L, y); y += 8.5; }
  y += 3;
  para(pitch.intro, 10.5, INK);

  /* ---- what we noticed ---- */
  if (pitch.notes.length) {
    heading(pitch.brand === 'printing' ? 'What you may need' : 'What we noticed');
    const pad = 5, width = R - L - pad * 2 - 6;
    font('regular', 10);
    const blocks = pitch.notes.map((n) => pdf.splitTextToSize(n, width));
    const boxH = blocks.reduce((s, ls) => s + ls.length * lh(10) + 2.5, 0) + pad * 1.4;
    need(boxH);
    pdf.setFillColor(...SOFT); pdf.roundedRect(L, y - 4, R - L, boxH, 3, 3, 'F');
    y += pad - 3;
    for (const lines of blocks) {
      pdf.setFillColor(...PRIMARY); pdf.circle(L + pad + 1, y - 1.2, 0.9, 'F');
      font('regular', 10, INK);
      lines.forEach((l) => { pdf.text(l, L + pad + 5, y); y += lh(10); });
      y += 2.5;
    }
    y += 3;
  }

  /* ---- what we propose ---- */
  if (pitch.services.length) {
    heading('What we propose');
    for (const raw of pitch.services) {
      const s = parseService(raw);
      const lines = s.text ? pdf.splitTextToSize(s.text, R - L - 8) : [];
      need(7 + lines.length * lh(9.5));
      pdf.setFillColor(...PRIMARY); pdf.roundedRect(L, y - 3.6, 3, 3, 0.6, 0.6, 'F');
      font('semibold', 10.5, DARK); pdf.text(s.title, L + 7, y);
      y += 5;
      font('regular', 9.5, SLATE);
      lines.forEach((l) => { pdf.text(l, L + 7, y); y += lh(9.5); });
      y += 3;
    }
  }

  /* ---- how we work ---- */
  heading('How we work');
  const steps = pitch.brand === 'printing'
    ? ['Share what you need: item, size, quantity and date', 'We send a design proof and a quotation', 'Printing and delivery after your approval']
    : ['A short call to understand your goals', 'A clear plan and quotation for you to approve', 'We start, and share progress every month'];
  const colW = (R - L - 8) / 3;
  need(22);
  steps.forEach((s, i) => {
    const x = L + i * (colW + 4);
    pdf.setFillColor(...SOFT); pdf.roundedRect(x, y - 4, colW, 20, 2.5, 2.5, 'F');
    font('bold', 12, PRIMARY); pdf.text(String(i + 1), x + 4, y + 1.5);
    font('regular', 8.8, INK);
    pdf.splitTextToSize(s, colW - 8).slice(0, 3).forEach((l, j) => pdf.text(l, x + 4, y + 7 + j * 3.8));
  });
  y += 22;

  /* ---- pricing + call to action ---- */
  heading('Next step');
  para('Pricing depends on the scope and is shared after a short discussion with you, so you only pay for what you need.', 10, INK);
  y += 2;
  const cta = [b.whatsapp && `WhatsApp ${b.whatsapp}`, b.email && `email ${b.email}`].filter(Boolean).join(' or ');
  if (cta) para(`Reply to this message, or reach us on ${cta}.`, 10, INK);

  footer();
  const blob = pdf.output('blob');
  const slug = pitch.lead.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'lead';
  return new File([blob], `${b.name.replace(/\s+/g, '-')}-Proposal-${slug}.pdf`, { type: 'application/pdf' });
}

/* ---------- share / download ---------- */
// Opens Android's share sheet with the PDF attached. Pick WhatsApp or Gmail there.
export async function sharePdf(file, text, title) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text, title }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  downloadFile(file);
  return 'downloaded';
}
export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
