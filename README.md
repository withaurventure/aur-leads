# AUR Leads

Phone app for the AUR Ventures lead agent: finds, checks and scores leads for AUR Studio
(medical + Web3) and AUR Printing Studio (bulk buyers, tenders, election printing),
then lets you call, chat, pitch and hand won clients to AUR Desk. Installs on Android from Chrome.
No app store, no build tools.

## What it does
- **Home**: All / AUR Studio / AUR Printing switch; new today, hot leads, follow-ups due, open tenders;
  "Call first" list with one-tap Call and WhatsApp; what the agent did today
- **Leads**: search, quick filters (score 7+, has phone, not contacted, Studio, Printing, follow-up due),
  city filter, sort; 40 at a time
- **Lead**: why it scored what it did; phone, WhatsApp, email, website, Instagram, Facebook, map in one tap;
  status, follow-up date, notes, timeline; edit contacts; Do not contact
- **Pitch**: send as AUR Studio or AUR Printing Studio; tick services; edit the wording; branded A4 PDF
  (never with prices) shared to WhatsApp or Gmail, or saved. Sending sets status to Proposal sent and a
  follow-up in 3 days
- **Won → AUR Desk**: marks the lead Won and adds it to AUR Desk's client list on this phone, with the
  onboarding checklist, without adding the same client twice
- **Tenders**: open bids with fit score, value, deadline, MSE / startup relaxation; status per tender
- **Review**: possible duplicates side by side (Merge / Not the same); recently merged with Undo
- **Settings**: pitch sender, per-brand name, tagline, WhatsApp, email, handle, services; change PIN,
  fingerprint; re-score all leads; sign out
- Locked with a 4–8 digit PIN plus fingerprint (same method as AUR Desk); locks after 1 minute in the background

Your leads live in Supabase (project `aur-leads`). The app only holds the publishable key, which opens
nothing without your Supabase sign-in, so this repository is safe to keep public.

## Before the first upload (once)
In Supabase → SQL Editor, run `06_app_support.sql` (it adds the Home summary, city list and pitch settings).

## Put it online (GitHub Pages, free)
1. Open github.com/withaurventure/aur-leads.
2. Choose **uploading an existing file** (or **Add file → Upload files**), drag in everything from this
   folder (keep the folders `css`, `js`, `icons`, `logos`, `fonts`, `vendor`), then **Commit changes**.
3. Go to **Settings → Pages** → "Deploy from a branch", branch `main`, folder `/ (root)` → **Save**.
4. After a minute or two the app is live at `https://withaurventure.github.io/aur-leads/`.

## Install on your phone
1. Open that link in **Chrome** on your Android phone.
2. Sign in with the Supabase user you created (withaurventure@gmail.com), then create your PIN.
3. Tap **⋮ menu → Add to Home screen → Install**.

For **Won → AUR Desk** to work, AUR Desk must have been opened at least once in the same Chrome on that phone.

## Updating later
Upload the changed files to the same repository and change `VERSION` in `sw.js` (for example `aur-leads-v2`).

## Files
- `index.html`, `css/app.css`: the page and all styling
- `js/config.js`: Supabase project URL and publishable key
- `js/app.js`: start-up, sign-in, lock, navigation
- `js/api.js`: Supabase sign-in and data (plain fetch)
- `js/security/lock.js`: PIN + fingerprint lock
- `js/screens/`: Home, Leads, Lead, Pitch, Tenders, Review, Settings
- `js/brands.js`, `js/pitchtext.js`, `js/pdf.js`: pitch settings, first-draft wording, PDF layout and sharing
- `js/leadactions.js`: status changes, contact logging, WhatsApp / call / email links
- `js/handoff.js`: Won → AUR Desk
- `vendor/jspdf.umd.min.js`: PDF engine (jsPDF, MIT licence, see `vendor/jspdf-LICENSE.txt`)
- `fonts/`: Montserrat for PDFs (SIL Open Font Licence, see `fonts/OFL.txt`)
- `logos/`: AUR Studio and AUR Printing Studio logos used on pitches
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support, install name and icon

Map data © OpenStreetMap contributors · Powered by Geoapify
