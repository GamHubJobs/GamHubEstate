/* ============================================================
   GAMHUB ESTATE — APP CONFIGURATION
   ============================================================ */
const APP_CONFIG = {
  SUPABASE_URL:        'https://pwexlhgizawjgteekkzf.supabase.co',
  SUPABASE_ANON_KEY:   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZXhsaGdpemF3amd0ZWVra3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5Mzg3NDgsImV4cCI6MjA5NDUxNDc0OH0.R-6dDci54V4lLewdUIuxAfLcZWRtAM5-PTszWqnCRII',
  MODEMPAY_PUBLIC_KEY: 'pk_live_51ebe3d202c7d2dfd9b31befc1536124a934c826ea02ba062aae2914bf5c2a39',
};

/* ============================================================
   UTILITIES
   ============================================================ */

/** HTML-escape a value for safe insertion */
function h(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function sanitizeText(val, maxLen) {
  if (!val) return '';
  return String(val).trim().slice(0, maxLen || 2000);
}
function sanitizeUrl(val) {
  const s = String(val || '').trim();
  return /^https?:\/\//i.test(s) ? s.slice(0, 500) : '';
}
function sanitizeEmail(val) {
  const s = String(val || '').trim().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}

/** URL-slug helper */
function slug(s) {
  return (s || 'property').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Simple toast notification */
function toast(msg, type, duration) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'default');
  const icons = { success: '✅', error: '❌', gold: '✦', default: 'ℹ️' };
  el.innerHTML = '<span>' + (icons[type] || 'ℹ️') + '</span> ' + h(msg);
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration || 3500);
}

/** Sanitise a full property payload before saving */
function sanitizePropertyPayload(p) {
  return {
    title:        sanitizeText(p.title,        160),
    agent_name:   sanitizeText(p.agent_name,   120),
    company:      sanitizeText(p.company,      120),
    email:        sanitizeEmail(p.email) || '',
    phone:        sanitizeText(p.phone,         40),
    website:      sanitizeUrl(p.website),
    logo_url:     sanitizeUrl(p.logo_url),
    listing_type: sanitizeText(p.listing_type,  40),
    category:     sanitizeText(p.category,      60),
    location:     sanitizeText(p.location,     100),
    street:       sanitizeText(p.street,       140),
    price:        sanitizeText(p.price,         80),
    price_type:   sanitizeText(p.price_type,    40),
    bedrooms:     sanitizeText(p.bedrooms,      20),
    bathrooms:    sanitizeText(p.bathrooms,     20),
    size:         sanitizeText(p.size,          60),
    available:    sanitizeText(p.available,     30),
    description:  sanitizeText(p.description, 6000),
    amenities:    Array.isArray(p.amenities) ? p.amenities.map(a => sanitizeText(a, 60)) : [],
    photos:       Array.isArray(p.photos)    ? p.photos.map(u => sanitizeUrl(u)).filter(Boolean) : [],
    map_link:     sanitizeUrl(p.map_link),
    plan:         ['free','featured','premium'].includes(p.plan) ? p.plan : 'free',
    approved:     false,
    submitted_at: p.submitted_at || new Date().toISOString(),
  };
}

/* localStorage helpers */
const STORAGE_KEYS = {
  agent:  'ghe_agent_listings',
  config: 'ghe_config',
};
function loadRaw(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function saveRaw(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.warn('Storage error', e); }
}

/* ============================================================
   RATE LIMITER
   ============================================================ */
const rateLimiter = (() => {
  const BUCKETS = {
    supabase_write: { maxCalls: 5,  windowMs: 60000  },
    supabase_read:  { maxCalls: 20, windowMs: 60000  },
    payment:        { maxCalls: 3,  windowMs: 600000 },
    auth:           { maxCalls: 5,  windowMs: 60000  },
  };
  const log = {};
  function check(key) {
    const bucket = BUCKETS[key];
    if (!bucket) return true;
    const now = Date.now();
    if (!log[key]) log[key] = [];
    log[key] = log[key].filter(ts => now - ts < bucket.windowMs);
    if (log[key].length >= bucket.maxCalls) {
      console.warn('[RateLimit] ' + key + ' blocked');
      return false;
    }
    log[key].push(now);
    return true;
  }
  function waitSeconds(key) {
    const bucket = BUCKETS[key];
    if (!bucket || !log[key] || !log[key].length) return 0;
    const now    = Date.now();
    const active = log[key].filter(ts => now - ts < bucket.windowMs);
    if (!active.length || active.length < bucket.maxCalls) return 0;
    return Math.ceil((bucket.windowMs - (now - active[0])) / 1000);
  }
  return { check, waitSeconds };
})();

/* ============================================================
   FREE LISTING RATE LIMITER
   ============================================================ */
const FREE_LISTING_RULES = {
  property: { max: 2, windowDays: 7, label: 'property listing'  },
  seeker:   { max: 2, windowDays: 7, label: 'seeker profile'    },
};
const FREE_LISTING_KEYS = {
  property: 'ghe_free_property_timestamps',
  seeker:   'ghe_free_seeker_timestamps',
};

function freeListingGetTimestamps(type) {
  const rule     = FREE_LISTING_RULES[type];
  const windowMs = rule.windowDays * 86400000;
  const cutoff   = Date.now() - windowMs;
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem(FREE_LISTING_KEYS[type]) || '[]'); } catch { stored = []; }
  return stored.filter(ts => ts > cutoff);
}
function freeListingCountRemaining(type) {
  return Math.max(0, FREE_LISTING_RULES[type].max - freeListingGetTimestamps(type).length);
}
function freeListingRecordUsage(type) {
  const key      = FREE_LISTING_KEYS[type];
  const rule     = FREE_LISTING_RULES[type];
  const windowMs = rule.windowDays * 86400000;
  const cutoff   = Date.now() - windowMs;
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem(key) || '[]'); } catch { stored = []; }
  stored = stored.filter(ts => ts > cutoff);
  stored.push(Date.now());
  try { localStorage.setItem(key, JSON.stringify(stored)); } catch {}
}
function freeListingShowLimitMessage(type) {
  const rule     = FREE_LISTING_RULES[type];
  const recent   = freeListingGetTimestamps(type);
  const oldestTs = recent.length ? Math.min(...recent) : Date.now();
  const resetsMs = (oldestTs + rule.windowDays * 86400000) - Date.now();
  const resetsH  = Math.ceil(resetsMs / 3600000);
  const resetMsg = resetsH <= 24
    ? 'Resets in ~' + resetsH + ' hour' + (resetsH === 1 ? '' : 's') + '.'
    : 'Resets in ~' + Math.ceil(resetsH / 24) + ' day' + (Math.ceil(resetsH / 24) === 1 ? '' : 's') + '.';
  toast(
    'Free ' + rule.label + ' limit reached (' + rule.max + ' per ' + rule.windowDays + ' days). ' +
    'Upgrade to a paid plan to post immediately. ' + resetMsg,
    'error', 9000
  );
}

/* ============================================================
   PROPERTY LISTINGS DATA
   Replace / extend this array as you add real listings.
   ============================================================ */
const PROPERTY_LISTINGS = [
  {
    id: 'villa-fajara-001',
    title: '4-Bedroom Villa with Pool — Fajara',
    agent: 'Gambia Realty Group',
    agent_name: 'Gambia Realty Group',
    company: 'Gambia Realty Group',
    email: 'info@gambiarealty.gm',
    phone: '+220 7712345',
    website: 'https://gambiarealty.gm',
    logo_url: '',
    listing_type: 'For Sale',
    category: 'Villa',
    location: 'Fajara',
    street: 'Atlantic Boulevard',
    price: 'GMD 4,500,000',
    price_type: 'negotiable',
    bedrooms: '4',
    bathrooms: '3',
    size: '320 sqm',
    available: '2026-06-01',
    description: 'A stunning four-bedroom villa set in the prestigious Fajara neighbourhood. This property features a fully tiled swimming pool, landscaped tropical gardens, and a modern open-plan kitchen. All bedrooms are en-suite with air conditioning. The compound is fully walled with electric gate and 24-hour security. Generator and borehole included. Within walking distance to Fajara beach and top restaurants.',
    amenities: ['🏊 Swimming Pool', '⚡ Generator', '💧 Borehole', '🔒 Security / Guard', '🌳 Garden', '🚗 Parking / Garage', '🌡️ Air Conditioning', '🛁 En-suite', '🏗️ Compound Wall'],
    photos: [],
    map_link: 'https://maps.google.com/?q=Fajara,Gambia',
    plan: 'featured',
    featured: true,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'apartment-kololi-001',
    title: '2-Bedroom Apartment — Kololi Beach Road',
    agent: 'Pacific Real Estate Ltd',
    agent_name: 'Amie Touray',
    company: 'Pacific Real Estate Ltd',
    email: 'amie@pacificrealty.gm',
    phone: '+220 7654321',
    website: '',
    logo_url: '',
    listing_type: 'For Rent',
    category: 'Apartment',
    location: 'Kololi',
    street: 'Kololi Beach Road',
    price: 'GMD 18,000/month',
    price_type: 'monthly',
    bedrooms: '2',
    bathrooms: '2',
    size: '110 sqm',
    available: '2026-05-15',
    description: 'Modern two-bedroom apartment on the popular Kololi Beach Road. Fully furnished with contemporary fixtures, tiled throughout, and fitted with split-unit air conditioning in all rooms. The building has a shared rooftop terrace with sea views and is moments from Senegambia Strip restaurants and nightlife. Ideal for expats or short-term lets.',
    amenities: ['⚡ Generator', '🌡️ Air Conditioning', '📡 Satellite TV', '🚗 Parking / Garage', '🏠 Furnished', '📶 WiFi Ready'],
    photos: [],
    map_link: '',
    plan: 'free',
    featured: false,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'compound-banjul-001',
    title: '5-Bedroom Compound House — Banjul Centre',
    agent: 'Lamin Jallow',
    agent_name: 'Lamin Jallow',
    company: '',
    email: 'lamin.jallow@email.gm',
    phone: '+220 9912345',
    website: '',
    logo_url: '',
    listing_type: 'For Sale',
    category: 'Compound',
    location: 'Banjul',
    street: 'Independence Drive area',
    price: 'GMD 3,200,000',
    price_type: 'negotiable',
    bedrooms: '5',
    bathrooms: '3',
    size: '450 sqm plot',
    available: '2026-07-01',
    description: 'Large traditional compound house in the heart of Banjul. Five bedrooms across the main house and a self-contained boys quarters. The property sits on a generous plot with fruit trees and a large courtyard. Mains water, NAWEC electricity and borehole. Prime location near the ferry terminal and Banjul market. Excellent investment opportunity.',
    amenities: ['💧 Borehole', '🌳 Garden', '🚗 Parking / Garage', '🏗️ Compound Wall', '📦 Storage Room'],
    photos: [],
    map_link: '',
    plan: 'free',
    featured: false,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'plot-brufut-001',
    title: 'Half Plot of Land — Brufut Heights',
    agent: 'Fatou Ceesay',
    agent_name: 'Fatou Ceesay',
    company: 'Brufut Land Associates',
    email: 'fatou@brufutland.gm',
    phone: '+220 7891234',
    website: '',
    logo_url: '',
    listing_type: 'Land',
    category: 'Plot',
    location: 'Brufut',
    street: 'Brufut Heights',
    price: 'GMD 950,000',
    price_type: 'fixed',
    bedrooms: '',
    bathrooms: '',
    size: '0.25 acres',
    available: '2026-05-20',
    description: 'Half plot of fully documented land in the rapidly growing Brufut Heights area. Documents include Lease, Site Plan and Permission to Develop. The land is flat and ready for immediate construction. Quiet residential neighbourhood, close to the main highway. Electricity and water connections nearby. Several new villas already built in the same estate.',
    amenities: ['🔒 Security / Guard', '🔑 Gated Community'],
    photos: [],
    map_link: 'https://maps.google.com/?q=Brufut,Gambia',
    plan: 'free',
    featured: false,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'office-kairaba-001',
    title: 'Modern Office Space — Kairaba Avenue',
    agent: 'Ousman Bojang',
    agent_name: 'Ousman Bojang',
    company: 'Kairaba Commercial Properties',
    email: 'o.bojang@kairabacp.gm',
    phone: '+220 7234567',
    website: 'https://kairabacp.gm',
    logo_url: '',
    listing_type: 'Commercial',
    category: 'Office',
    location: 'Kairaba Avenue',
    street: 'Kairaba Avenue, near Westfield junction',
    price: 'GMD 45,000/month',
    price_type: 'monthly',
    bedrooms: '',
    bathrooms: '2',
    size: '180 sqm',
    available: '2026-06-01',
    description: 'Premium open-plan office space on the prestigious Kairaba Avenue, the commercial spine of Greater Banjul. The space is freshly painted, fully tiled, and fitted with split air conditioning throughout. Ground floor unit with direct street access and dedicated parking for six vehicles. 24-hour security and generator backup. Ideal for embassies, NGOs, financial institutions or corporate headquarters.',
    amenities: ['⚡ Generator', '🌡️ Air Conditioning', '🔒 Security / Guard', '🚗 Parking / Garage', '📶 WiFi Ready', '📡 Satellite TV'],
    photos: [],
    map_link: '',
    plan: 'premium',
    featured: true,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'house-bakau-001',
    title: '3-Bedroom House — Bakau New Town',
    agent: 'Mariama Sanneh',
    agent_name: 'Mariama Sanneh',
    company: 'Atlantic Property Consultants',
    email: 'mariama@atlanticpc.gm',
    phone: '+220 7345678',
    website: '',
    logo_url: '',
    listing_type: 'For Rent',
    category: 'House',
    location: 'Bakau',
    street: 'Bakau New Town',
    price: 'GMD 25,000/month',
    price_type: 'monthly',
    bedrooms: '3',
    bathrooms: '2',
    size: '200 sqm',
    available: '2026-06-15',
    description: 'Spacious three-bedroom house in Bakau New Town, just minutes from the beach. The property has a large living/dining area, modern kitchen, and a private garden with seating area. Master bedroom with en-suite. Solar panels installed for energy saving. Borehole and generator provide uninterrupted utilities. Quiet, family-friendly neighbourhood close to schools and healthcare.',
    amenities: ['⚡ Generator', '💧 Borehole', '🌳 Garden', '🌡️ Air Conditioning', '🏗️ Compound Wall', '☀️ Solar Panels', '🛁 En-suite', '🔒 Security / Guard'],
    photos: [],
    map_link: '',
    plan: 'free',
    featured: false,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'apartment-serrekunda-001',
    title: 'Studio Apartment — Serrekunda Market Area',
    agent: 'Yankuba Drammeh',
    agent_name: 'Yankuba Drammeh',
    company: '',
    email: 'y.drammeh@email.gm',
    phone: '+220 6789012',
    website: '',
    logo_url: '',
    listing_type: 'For Rent',
    category: 'Apartment',
    location: 'Serrekunda',
    street: 'Near Serrekunda Market',
    price: 'GMD 6,500/month',
    price_type: 'monthly',
    bedrooms: 'Studio',
    bathrooms: '1',
    size: '45 sqm',
    available: '2026-05-10',
    description: 'Compact and affordable studio apartment in the heart of Serrekunda. Tiled throughout, fitted with ceiling fan and a small kitchenette. Shared compound with borehole. Walking distance to Serrekunda market, banks, and transport links. Suitable for a single professional or student. Available immediately.',
    amenities: ['💧 Borehole', '🏪 Near Market'],
    photos: [],
    map_link: '',
    plan: 'free',
    featured: false,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'villa-bijilo-001',
    title: '6-Bedroom Sea View Villa — Bijilo',
    agent: 'Omar Ceesay',
    agent_name: 'Omar Ceesay',
    company: 'Bijilo Luxury Properties',
    email: 'omar@bijiloluxury.gm',
    phone: '+220 7901234',
    website: 'https://bijiloluxury.gm',
    logo_url: '',
    listing_type: 'For Sale',
    category: 'Villa',
    location: 'Bijilo',
    street: 'Bijilo Beach Road',
    price: 'GMD 12,000,000',
    price_type: 'negotiable',
    bedrooms: '6',
    bathrooms: '5',
    size: '680 sqm',
    available: '2026-08-01',
    description: 'Exceptional six-bedroom luxury villa directly on the Bijilo beachfront. This outstanding property offers panoramic Atlantic Ocean views from a private infinity pool and wraparound terrace. European-standard kitchen and bathrooms, marble floors throughout, and a dedicated staff quarters. The fully walled compound includes a double garage, generator house, and landscaped grounds. A rare opportunity to own one of The Gambia\'s finest properties.',
    amenities: ['🏊 Swimming Pool', '⚡ Generator', '💧 Borehole', '🔒 Security / Guard', '🌳 Garden', '🚗 Parking / Garage', '🌡️ Air Conditioning', '📡 Satellite TV', '🌊 Sea View', '🛁 En-suite', '🍳 Modern Kitchen', '🏗️ Compound Wall', '☀️ Solar Panels', '🏠 Furnished', '🔑 Gated Community'],
    photos: [],
    map_link: 'https://maps.google.com/?q=Bijilo,Gambia',
    plan: 'premium',
    featured: true,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

/* ============================================================
   VIEW ROUTING
   ============================================================ */
const VIEWS = [
  'landing',
  'search',
  'property-detail',
  'agent-portal',
  'seeker-board',
  'privacy',
  'terms',
];

let currentView = 'landing';

function showView(id) {
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.remove('active');
  });

  const target = document.getElementById('view-' + id);
  if (!target) return;
  target.classList.add('active');
  currentView = id;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update body class for view-specific overrides
  document.body.className = document.body.className.replace(/\bview-\S+/g, '').trim();
  document.body.classList.add('view-' + id);

  // View init hooks
  if (id === 'search')       initSearchView();
  if (id === 'agent-portal') initAgentPortal();
  if (id === 'seeker-board') {
    if (typeof initSeekerBoard === 'function') initSeekerBoard();
  }

  // Tour hints
  if (typeof GHETour !== 'undefined') GHETour.triggerView(id);
}

/* Scroll helpers */
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

function scrollToSection(id) {
  showView('landing');
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 120);
}

/* Mobile nav */
function toggleMobileNav() {
  document.getElementById('mobile-drawer')?.classList.toggle('open');
  document.getElementById('hamburger')?.classList.toggle('open');
}
function closeMobileNav() {
  document.getElementById('mobile-drawer')?.classList.remove('open');
  document.getElementById('hamburger')?.classList.remove('open');
}

/* ============================================================
   HERO QUICK SEARCH
   ============================================================ */
function heroSearch() {
  const type     = document.getElementById('hero-type')?.value     || '';
  const location = document.getElementById('hero-location')?.value || '';
  const beds     = document.getElementById('hero-beds')?.value     || '';

  showView('search');

  // Pre-fill search filters after short delay so the view renders first
  setTimeout(() => {
    if (type)     { const el = document.getElementById('ps-type');     if (el) el.value = type; }
    if (location) { const el = document.getElementById('ps-location'); if (el) el.value = location; }
    if (beds)     { const el = document.getElementById('ps-beds');     if (el) el.value = beds; }
    filterProperties();
  }, 150);
}

/** Called from landing page location chips */
function quickFilterLocation(loc) {
  showView('search');
  setTimeout(() => {
    const el = document.getElementById('ps-location');
    if (el) el.value = loc;
    filterProperties();
  }, 150);
}

/** Called from landing page type cards */
function quickFilterType(type) {
  showView('search');
  setTimeout(() => {
    const el = document.getElementById('ps-type');
    if (el) el.value = type;
    filterProperties();
  }, 150);
}

/* ============================================================
   PROPERTY SEARCH — INIT & FILTER
   ============================================================ */
function initSearchView() {
  renderProperties(getAllProperties());
}
/**
 * Returns all properties: featured+premium first, then standard,
 * merged with any locally posted listings.
 */
function getAllProperties() {
  const localRaw = loadRaw(STORAGE_KEYS.agent) || [];
  const approved = localRaw.filter(p => p.approved !== false);
  const featured = approved.filter(p => p.featured);
  const standard = approved.filter(p => !p.featured);

  const staticFeatured = PROPERTY_LISTINGS.filter(p => p.featured);
  const staticStandard = PROPERTY_LISTINGS.filter(p => !p.featured);

  return [...featured, ...staticFeatured, ...standard, ...staticStandard];
}

function filterProperties() {
  const kw       = (document.getElementById('ps-keyword')?.value  || '').toLowerCase().trim();
  const type     = document.getElementById('ps-type')?.value      || '';
  const category = document.getElementById('ps-category')?.value  || '';
  const location = document.getElementById('ps-location')?.value  || '';
  const beds     = document.getElementById('ps-beds')?.value      || '';

  const filtered = getAllProperties().filter(p => {
    const inText = !kw ||
      (p.title       || '').toLowerCase().includes(kw) ||
      (p.description || '').toLowerCase().includes(kw) ||
      (p.agent       || '').toLowerCase().includes(kw) ||
      (p.location    || '').toLowerCase().includes(kw);

    const inType     = !type     || p.listing_type === type;
    const inCategory = !category || p.category     === category;
    const inLocation = !location || p.location     === location;
    const inBeds     = !beds     || bedsMatch(p.bedrooms, beds);

    return inText && inType && inCategory && inLocation && inBeds;
  });

  renderProperties(filtered);
}

function bedsMatch(bedroomsVal, minBeds) {
  if (!bedroomsVal || bedroomsVal === 'Studio') return parseInt(minBeds) <= 0;
  const n = parseInt(bedroomsVal);
  return !isNaN(n) && n >= parseInt(minBeds);
}

/* ============================================================
   RENDER PROPERTY GRID
   ============================================================ */
function renderProperties(list) {
  const grid  = document.getElementById('ps-property-grid');
  const empty = document.getElementById('ps-empty');
  const meta  = document.getElementById('ps-result-meta');
  if (!grid) return;

  grid.innerHTML = '';

  const total = getAllProperties().length;

  if (!list.length) {
    grid.style.display = 'none';
    if (empty) empty.style.display = '';
    if (meta)  meta.innerHTML = 'Showing <strong>0</strong> properties';
    return;
  }

  grid.style.display = '';
  if (empty) empty.style.display = 'none';
  if (meta)  meta.innerHTML =
    'Showing <strong>' + list.length + '</strong> of <strong>' + total + '</strong> properties';

  list.forEach(prop => grid.appendChild(createPropertyCard(prop)));
}

/* ============================================================
   CREATE PROPERTY CARD
   ============================================================ */
function createPropertyCard(prop) {
  const card = document.createElement('div');
  card.className = 'ps-card';
  card.addEventListener('click', () => openPropertyPage(prop));

  // Type badge class
  const typeClass = {
    'For Sale':   'ps-badge-type-sale',
    'For Rent':   'ps-badge-type-rent',
    'Commercial': 'ps-badge-type-comm',
    'Land':       'ps-badge-type-land',
  }[prop.listing_type] || 'ps-badge-type-sale';

  // Photo — first photo or placeholder
  const firstPhoto = prop.photos && prop.photos.length ? prop.photos[0] : '';
  const photoHTML  = firstPhoto
    ? `<div class="ps-card-photo"><img src="${h(firstPhoto)}" alt="${h(prop.title)}" loading="lazy">
         ${prop.price ? `<div class="ps-card-price-badge">${h(prop.price)}</div>` : ''}
       </div>`
    : `<div class="ps-card-photo-placeholder">
         ${{ 'For Sale': '🏡', 'For Rent': '🔑', 'Commercial': '🏢', 'Land': '📐' }[prop.listing_type] || '🏠'}
         ${prop.price ? `<div class="ps-card-price-badge" style="position:absolute;bottom:12px;left:12px">${h(prop.price)}</div>` : ''}
       </div>`;

  // Plan badge
  let planBadgeHTML = '';
  if (prop.plan === 'premium') {
    planBadgeHTML = '<div class="ps-card-plan-badge"><span class="property-plan-badge premium">🏆 Premium</span></div>';
  } else if (prop.plan === 'featured') {
    planBadgeHTML = '<div class="ps-card-plan-badge"><span class="property-plan-badge featured">⭐ Featured</span></div>';
  }

  // Logo / fallback
  const initials = (prop.agent || prop.company || 'AG').split(' ').slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');
  const logoHTML = prop.logo_url
    ? `<img class="ps-card-logo" src="${h(prop.logo_url)}" alt="${h(prop.agent)} logo" loading="lazy">`
    : `<div class="ps-card-logo-fallback">${initials || '🏠'}</div>`;

  // Beds badge
  const bedsLabel = prop.bedrooms
    ? `<span class="ps-badge ps-badge-beds">${h(prop.bedrooms)} ${prop.bedrooms === 'Studio' ? '' : 'Bed'}</span>`
    : '';

  card.innerHTML = `
    ${photoHTML}
    ${planBadgeHTML}
    <div class="ps-card-body">
      <div class="ps-card-head">
        ${logoHTML}
        <div class="ps-card-title-wrap">
          <h3 class="ps-card-title">${h(prop.title)}</h3>
          <p class="ps-card-agent">${h(prop.agent || prop.agent_name || '')}</p>
        </div>
      </div>
      <div class="ps-card-badges">
        <span class="ps-badge ${typeClass}">${h(prop.listing_type)}</span>
        ${prop.category ? `<span class="ps-badge ps-badge-cat">${h(prop.category)}</span>` : ''}
        ${prop.location ? `<span class="ps-badge ps-badge-loc">${h(prop.location)}</span>` : ''}
        ${bedsLabel}
      </div>
      <p class="ps-card-desc">${h(prop.description || '')}</p>
      <div class="ps-card-actions">
        <button class="ps-btn-view"
          onclick="event.stopPropagation();openPropertyPage(getAllProperties().find(p=>p.id==='${h(prop.id)}'))">
          View Details →
        </button>
        <button class="ps-btn-contact"
          onclick="event.stopPropagation();contactAgent('${h(prop.id)}')">
          Contact →
        </button>
      </div>
    </div>
  `;

  return card;
}

/* ============================================================
   PROPERTY DETAIL — FULL PAGE VIEW
   ============================================================ */
let _selectedPropertyId = null;

function openPropertyPage(prop) {
  if (!prop) return;
  _selectedPropertyId = prop.id;

  /* ── Header ── */
  const initials = (prop.agent || 'AG').split(' ').slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');
  const logoHTML = prop.logo_url
    ? `<img class="ps-card-logo" style="width:64px;height:64px;border-radius:14px" src="${h(prop.logo_url)}" alt="${h(prop.agent)} logo">`
    : `<div class="ps-card-logo-fallback" style="width:64px;height:64px;font-size:22px;border-radius:14px">${initials || '🏠'}</div>`;

  const logoEl = document.getElementById('pd-page-logo');
  if (logoEl) logoEl.innerHTML = logoHTML;

  const titleEl = document.getElementById('pd-page-title');
  const agentEl = document.getElementById('pd-page-agent');
  if (titleEl) titleEl.textContent = prop.title || '';
  if (agentEl) agentEl.textContent = (prop.agent || prop.agent_name || '') + (prop.company ? ' · ' + prop.company : '');

  /* ── Chips ── */
  const typeClass = {
    'For Sale':   'pd-chip-type-sale',
    'For Rent':   'pd-chip-type-rent',
    'Commercial': 'pd-chip-type-comm',
    'Land':       'pd-chip-type-land',
  }[prop.listing_type] || 'pd-chip-type-sale';

  const chipsEl = document.getElementById('pd-page-chips');
  if (chipsEl) chipsEl.innerHTML = [
    prop.listing_type && `<span class="pd-chip ${typeClass}">🏠 ${h(prop.listing_type)}</span>`,
    prop.price        && `<span class="pd-chip pd-chip-price">💰 ${h(prop.price)}</span>`,
    prop.bedrooms     && `<span class="pd-chip pd-chip-beds">🛏 ${h(prop.bedrooms)} ${prop.bedrooms === 'Studio' ? '' : 'Bed'}</span>`,
    prop.location     && `<span class="pd-chip pd-chip-loc">📍 ${h(prop.location)}</span>`,
    prop.featured     && `<span class="pd-chip" style="background:rgba(201,169,110,0.12);border:1px solid rgba(201,169,110,0.35);color:var(--gold2)">⭐ Featured</span>`,
  ].filter(Boolean).join('');

  /* ── Photos ── */
  const photoGallery = document.getElementById('pd-page-photo-gallery');
  const secPhotos    = document.getElementById('pd-page-sec-photos');
  if (photoGallery) {
    if (prop.photos && prop.photos.length) {
      photoGallery.innerHTML = prop.photos.map(url =>
        `<img src="${h(url)}" alt="${h(prop.title)}" loading="lazy" onclick="openPhotoLightbox('${h(url)}')">`
      ).join('');
      if (secPhotos) secPhotos.style.display = '';
    } else {
      if (secPhotos) secPhotos.style.display = 'none';
    }
  }

  /* ── Agent details grid ── */
  const agentItems = [
    { label: 'Agent / Seller', value: prop.agent || prop.agent_name },
    { label: 'Agency',         value: prop.company },
    { label: 'Email',          value: prop.email,   link: prop.email ? 'mailto:' + prop.email : null },
    { label: 'Phone / WA',     value: prop.phone,   link: prop.phone ? 'https://wa.me/' + prop.phone.replace(/[^0-9]/g, '') : null },
    { label: 'Website',        value: prop.website, link: prop.website },
  ].filter(i => i.value);

  const agentGrid = document.getElementById('pd-page-agent-grid');
  if (agentGrid) agentGrid.innerHTML = agentItems.map(i => `
    <div class="pd-detail-item">
      <div class="pd-detail-label">${h(i.label)}</div>
      <div class="pd-detail-value">${i.link
        ? `<a href="${h(i.link)}" target="_blank" rel="noopener noreferrer">${h(i.value)}</a>`
        : h(i.value)
      }</div>
    </div>
  `).join('');
  const secAgent = document.getElementById('pd-page-sec-agent');
  if (secAgent) secAgent.style.display = agentItems.length ? '' : 'none';

  /* ── Property specs grid ── */
  const specItems = [
    { label: 'Type',       value: prop.listing_type },
    { label: 'Category',   value: prop.category     },
    { label: 'Location',   value: prop.location     },
    { label: 'Street',     value: prop.street       },
    { label: 'Price',      value: prop.price        },
    { label: 'Price Type', value: prop.price_type   },
    { label: 'Bedrooms',   value: prop.bedrooms     },
    { label: 'Bathrooms',  value: prop.bathrooms    },
    { label: 'Size',       value: prop.size         },
    { label: 'Available',  value: prop.available    },
  ].filter(i => i.value);

  const specsGrid = document.getElementById('pd-page-specs-grid');
  if (specsGrid) specsGrid.innerHTML = specItems.map(i => `
    <div class="pd-detail-item">
      <div class="pd-detail-label">${h(i.label)}</div>
      <div class="pd-detail-value">${h(i.value)}</div>
    </div>
  `).join('');
  const secSpecs = document.getElementById('pd-page-sec-specs');
  if (secSpecs) secSpecs.style.display = specItems.length ? '' : 'none';

  /* ── Description ── */
  const descEl   = document.getElementById('pd-page-description');
  const secDesc  = document.getElementById('pd-page-sec-desc');
  if (descEl) descEl.textContent = prop.description || '';
  if (secDesc) secDesc.style.display = prop.description ? '' : 'none';

  /* ── Features / Amenities ── */
  const featEl  = document.getElementById('pd-page-features');
  const secFeat = document.getElementById('pd-page-sec-features');
  if (featEl) {
    const amenities = prop.amenities || [];
    if (amenities.length) {
      featEl.innerHTML = '<div class="pd-amenity-tags">' +
        amenities.map(a => `<span class="pd-amenity-tag">${h(a)}</span>`).join('') +
        '</div>';
      if (secFeat) secFeat.style.display = '';
    } else {
      if (secFeat) secFeat.style.display = 'none';
    }
  }

  /* ── Contact info ── */
  const contactEl  = document.getElementById('pd-page-contact-info');
  const secContact = document.getElementById('pd-page-sec-contact');
  if (contactEl) {
    contactEl.textContent = prop.email
      ? 'Reach out to ' + (prop.agent || 'the agent') + ' directly via email or WhatsApp to arrange a viewing.'
      : 'Contact information available on request.';
  }
  if (secContact) secContact.style.display = '';

  /* ── Actions ── */
  const actionsEl = document.getElementById('pd-page-actions');
  if (actionsEl) {
    actionsEl.innerHTML = '';

    if (prop.email) {
      const emailBtn = document.createElement('button');
      emailBtn.className   = 'pd-apply-btn pd-apply-primary';
      emailBtn.textContent = '✉ Email Agent';
      emailBtn.addEventListener('click', () => contactAgent(prop.id));
      actionsEl.appendChild(emailBtn);
    }

    if (prop.phone) {
      const waBtn    = document.createElement('a');
      waBtn.className   = 'pd-apply-btn pd-apply-whatsapp';
      waBtn.textContent = '💬 WhatsApp Agent';
      waBtn.href        = 'https://wa.me/' + prop.phone.replace(/[^0-9]/g, '') +
        '?text=' + encodeURIComponent('Hi, I\'m interested in your listing: ' + prop.title + ' on GamHub Estate.');
      waBtn.target = '_blank';
      waBtn.rel    = 'noopener noreferrer';
      actionsEl.appendChild(waBtn);
    }

    if (prop.map_link) {
      const mapBtn = document.createElement('a');
      mapBtn.className   = 'pd-apply-btn pd-apply-ghost';
      mapBtn.textContent = '📍 View on Map';
      mapBtn.href        = prop.map_link;
      mapBtn.target      = '_blank';
      mapBtn.rel         = 'noopener noreferrer';
      actionsEl.appendChild(mapBtn);
    }

    const backBtn = document.createElement('button');
    backBtn.className   = 'pd-apply-btn pd-apply-ghost';
    backBtn.textContent = '← Back to Properties';
    backBtn.addEventListener('click', () => showView('search'));
    actionsEl.appendChild(backBtn);
  }

  /* ── Map link in contact ── */
  showView('property-detail');
}

/* Back button */
document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('pd-back-btn');
  if (backBtn) backBtn.addEventListener('click', () => showView('search'));
});

/* ============================================================
   CONTACT AGENT (email)
   ============================================================ */
function contactAgent(id) {
  const prop = getAllProperties().find(p => String(p.id) === String(id));
  if (!prop || !prop.email) {
    toast('No contact email available for this property.', 'error');
    return;
  }
  const subject = encodeURIComponent('Property Enquiry via GamHub Estate — ' + prop.title);
  const body    = encodeURIComponent(
    'Hello ' + (prop.agent || 'there') + ',\n\n' +
    'I found your listing on GamHub Estate and I am interested in:\n\n' +
    '📍 ' + prop.title + '\n' +
    '💰 ' + (prop.price || 'Price TBC') + '\n\n' +
    'Could we please arrange a viewing at your earliest convenience?\n\n' +
    'Kind regards'
  );
  window.location.href = 'mailto:' + prop.email + '?subject=' + subject + '&body=' + body;
}

/* ============================================================
   PHOTO LIGHTBOX
   ============================================================ */
function openPhotoLightbox(url) {
  const existing = document.getElementById('ghe-lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.id = 'ghe-lightbox';
  lb.style.cssText =
    'position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,0.93);' +
    'display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out;';
  lb.innerHTML = `
    <button style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;width:40px;height:40px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
    <img src="${h(url)}" alt="Property photo" style="max-width:100%;max-height:90dvh;object-fit:contain;border-radius:8px;box-shadow:0 20px 80px rgba(0,0,0,0.7);">
  `;
  lb.addEventListener('click', () => lb.remove());
  lb.querySelector('button').addEventListener('click', e => { e.stopPropagation(); lb.remove(); });
  document.body.appendChild(lb);
}

/* ============================================================
   PROPERTY PREVIEW (sidebar, live update while typing)
   ============================================================ */
function updatePropertyPreview() {
  const title      = document.getElementById('pp-title')?.value      || '';
  const agentName  = document.getElementById('pp-agent-name')?.value || '';
  const location   = document.getElementById('pp-location')?.value   || '';
  const type       = document.getElementById('pp-listing-type')?.value || '';
  const beds       = document.getElementById('pp-bedrooms')?.value   || '';
  const price      = document.getElementById('pp-price')?.value      || '';
  const desc       = document.getElementById('pp-description')?.value|| '';
  const logoUrl    = document.getElementById('pp-logo-url')?.value?.trim() || '';

  const titleEl    = document.getElementById('prev-title');
  const agentEl    = document.getElementById('prev-agent');
  const locEl      = document.getElementById('prev-location');
  const typeEl     = document.getElementById('prev-type');
  const bedsEl     = document.getElementById('prev-beds');
  const priceEl    = document.getElementById('prev-price');
  const descEl     = document.getElementById('prev-desc');
  const logoWrapEl = document.getElementById('prev-logo-wrap');

  if (titleEl)    titleEl.textContent   = title    || 'Property Title';
  if (agentEl)    agentEl.textContent   = agentName || 'Agent Name';
  if (locEl)      locEl.textContent     = '📍 ' + (location || 'Location');
  if (typeEl)     typeEl.textContent    = '🏠 ' + (type || 'Type');
  if (descEl)     descEl.textContent    = (desc || 'Your property description will appear here…').slice(0, 160);

  if (bedsEl) {
    if (beds) { bedsEl.textContent = '🛏 ' + beds + (beds === 'Studio' ? '' : ' Bed'); bedsEl.style.display = ''; }
    else      { bedsEl.style.display = 'none'; }
  }
  if (priceEl) {
    if (price) { priceEl.textContent = '💰 ' + price; priceEl.style.display = ''; }
    else       { priceEl.style.display = 'none'; }
  }

  const plan      = getSelectedPlan();
  const badgeEl   = document.getElementById('prev-plan-badge');
  if (badgeEl) {
    badgeEl.innerHTML = plan === 'premium'
      ? '<span class="property-plan-badge premium">🏆 Premium</span>'
      : plan === 'featured'
      ? '<span class="property-plan-badge featured">⭐ Featured</span>'
      : '';
  }

  if (logoWrapEl) {
    logoWrapEl.innerHTML = logoUrl && /^https?:\/\//i.test(logoUrl)
      ? `<img src="${h(logoUrl)}" class="ps-card-logo" style="width:36px;height:36px">`
      : `<div class="property-card-logo-placeholder" style="width:36px;height:36px;font-size:14px">🏡</div>`;
  }
}

function updateCharCount(inputId, countId, max) {
  const val = document.getElementById(inputId)?.value || '';
  const el  = document.getElementById(countId);
  if (el) {
    el.textContent = val.length + ' / ' + max;
    el.style.color = val.length > max * 0.9 ? '#f87171' : 'var(--muted)';
  }
}

/* ============================================================
   PLAN & AMENITY HELPERS
   ============================================================ */
function selectPlan(card, plan) {
  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  card.dataset.plan = plan;

  const labels = {
    free:     '✦ Submit Free Listing',
    featured: '💳 Pay GMD 25 — Submit Featured Listing',
    premium:  '💳 Pay GMD 50 — Submit Premium Listing',
  };
  const notes = {
    free:     'Free listings are reviewed manually within 24 hours. No payment required.',
    featured: 'You will be redirected to ModemPay to complete payment securely in GMD.',
    premium:  'You will be redirected to ModemPay to complete payment securely in GMD.',
  };
  const labelEl = document.getElementById('submit-btn-label');
  const noteEl  = document.getElementById('submit-btn-note');
  if (labelEl) labelEl.textContent = labels[plan] || labels.free;
  if (noteEl)  noteEl.textContent  = notes[plan]  || notes.free;

  updatePropertyPreview();
}

function getSelectedPlan() {
  const sel = document.querySelector('.plan-card.selected');
  return sel ? (sel.dataset.plan || 'free') : 'free';
}

function toggleAmenity(chip) {
  chip.classList.toggle('selected');
}

function getSelectedAmenities() {
  return Array.from(document.querySelectorAll('.amenity-chip.selected'))
    .map(c => c.textContent.trim());
}

/* ============================================================
   SUBMIT PROPERTY POST
   ============================================================ */
async function submitPropertyPost() {
  /* Collect & validate */
  const title      = document.getElementById('pp-title')?.value.trim()        || '';
  const agentName  = document.getElementById('pp-agent-name')?.value.trim()   || '';
  const email      = document.getElementById('pp-email')?.value.trim()        || '';
  const phone      = document.getElementById('pp-phone')?.value.trim()        || '';
  const location   = document.getElementById('pp-location')?.value            || '';
  const listType   = document.getElementById('pp-listing-type')?.value        || '';
  const description= document.getElementById('pp-description')?.value.trim()  || '';

  if (!title)                         { toast('Please enter a property title', 'error'); return; }
  if (!agentName)                     { toast('Please enter your name or agency name', 'error'); return; }
  if (!email || !email.includes('@')) { toast('Please enter a valid contact email', 'error'); return; }
  if (!phone)                         { toast('Please enter a WhatsApp / phone number', 'error'); return; }
  if (!location)                      { toast('Please select a location', 'error'); return; }
  if (!listType)                      { toast('Please select the listing type (Sale / Rent / etc.)', 'error'); return; }
  if (description.length < 100)       { toast('Description must be at least 100 characters', 'error'); return; }

  const plan   = getSelectedPlan();
  const amount = MODEMPAY_CONFIG.PRICES[plan] || 0;

  /* Rate limit — free plan only */
  if (amount === 0) {
    const remaining = freeListingCountRemaining('property');
    if (remaining <= 0) { freeListingShowLimitMessage('property'); return; }
    if (remaining === 1) toast('Heads up — this is your last free listing for the next 7 days.', 'gold', 5000);
  }

  /* Build payload */
  const photosRaw = (document.getElementById('pp-photos')?.value || '')
    .split('\n').map(u => u.trim()).filter(u => /^https?:\/\//i.test(u));

  const rawPayload = {
    title,
    agent_name:   agentName,
    company:      document.getElementById('pp-company')?.value.trim()   || '',
    email,
    phone,
    website:      document.getElementById('pp-website')?.value.trim()   || '',
    logo_url:     document.getElementById('pp-logo-url')?.value.trim()  || '',
    listing_type: listType,
    category:     document.getElementById('pp-category')?.value         || '',
    location,
    street:       document.getElementById('pp-street')?.value.trim()    || '',
    price:        document.getElementById('pp-price')?.value.trim()     || '',
    price_type:   document.getElementById('pp-price-type')?.value       || 'fixed',
    bedrooms:     document.getElementById('pp-bedrooms')?.value         || '',
    bathrooms:    document.getElementById('pp-bathrooms')?.value        || '',
    size:         document.getElementById('pp-size')?.value.trim()      || '',
    available:    document.getElementById('pp-available')?.value        || '',
    description,
    amenities:    getSelectedAmenities(),
    photos:       photosRaw,
    map_link:     document.getElementById('pp-map-link')?.value.trim()  || '',
    plan,
    approved:     false,
    submitted_at: new Date().toISOString(),
  };
  const payload = sanitizePropertyPayload(rawPayload);
  payload.agent = agentName; // convenience alias for display

  /* Submit button loading state */
  const btn = document.getElementById('submit-property-btn');
  if (btn) { btn.classList.add('btn-submitting'); btn.disabled = true; }

  if (amount > 0) {
    if (btn) { btn.classList.remove('btn-submitting'); btn.disabled = false; }
    submitPropertyPaymentForm(payload, plan, amount);
  } else {
    await savePropertyDirectly(payload);
    if (btn) { btn.classList.remove('btn-submitting'); btn.disabled = false; }
  }
}

/* ============================================================
   SAVE PROPERTY (free listing)
   ============================================================ */
async function savePropertyDirectly(payload) {
  let savedRemotely = false;

  /* Try Supabase */
  try {
    if (SB_CONNECTED) {
      await sbInsertProperty(payload);
      savedRemotely = true;
    }
  } catch(err) {
    console.warn('[Agent] Supabase insert failed:', err.message);
  }

  /* Always save locally */
  const localId  = 'local-' + Date.now();
  const localProp = { ...payload, id: localId, _local: !savedRemotely };
  const myList   = loadRaw(STORAGE_KEYS.agent) || [];
  myList.unshift(localProp);
  saveRaw(STORAGE_KEYS.agent, myList);

  /* Record usage */
  freeListingRecordUsage('property');

  /* Show success */
  document.getElementById('post-property-form').style.display  = 'none';
  document.getElementById('submission-success').classList.add('show');

  /* Send WhatsApp admin notification */
  setTimeout(() => sendPropertyNotificationWhatsApp(payload, 'free'), 600);

  toast(
    savedRemotely ? 'Property listed! Saved to database ✓' : 'Property saved locally ✓',
    savedRemotely ? 'success' : 'gold',
    4000
  );

  updatePortalStats();
}

/* ============================================================
   PAYMENT FORM (paid plans)
   ============================================================ */
function submitPropertyPaymentForm(payload, plan, amount) {
  if (!rateLimiter.check('payment')) {
    toast('Too many payment attempts — please wait ' + rateLimiter.waitSeconds('payment') + 's.', 'error', 5000);
    return;
  }

  /* Persist payload before redirect */
  try {
    localStorage.setItem('ghe_pending_property', JSON.stringify(payload));
    const verify = JSON.parse(localStorage.getItem('ghe_pending_property'));
    if (!verify || !verify.title) { toast('Could not save property data. Please try again.', 'error', 5000); return; }
  } catch(e) { toast('Storage error. Please try again.', 'error', 5000); return; }

  const base      = window.location.origin + window.location.pathname;
  const token     = 'prop-' + Date.now();
  const returnUrl = base + '?ghe_payment=success&ghe_token=' + token;
  const cancelUrl = base + '?ghe_payment=cancelled';
  const mpTrim    = (v, max) => String(v || '').trim().slice(0, max || 255);

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://checkout.modempay.com/api/pay';
  form.style.display = 'none';

  const fields = {
    public_key:     mpTrim(APP_CONFIG.MODEMPAY_PUBLIC_KEY, 255),
    amount:         mpTrim(String(amount), 20),
    currency:       'GMD',
    customer_name:  mpTrim(payload.agent_name || 'GamHub Estate User', 100),
    customer_email: mpTrim(payload.email      || 'user@gamhubestate.gm', 100),
    customer_phone: '7000000',
    return_url:     mpTrim(returnUrl, 255),
    cancel_url:     mpTrim(cancelUrl, 255),
    'metadata[source]':  'gamhubestate',
    'metadata[plan]':    mpTrim(plan, 20),
    'metadata[title]':   mpTrim(payload.title || '', 100),
    'metadata[token]':   mpTrim(token, 80),
  };

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type  = 'hidden';
    input.name  = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  toast('Redirecting to ModemPay… GMD ' + amount, 'gold', 2000);
  setTimeout(() => form.submit(), 600);
}

/* ModemPay config */
const MODEMPAY_CONFIG = {
  PRICES: { free: 0, featured: 25, premium: 50 },
};

/* ============================================================
   PAYMENT RETURN HANDLER
   ============================================================ */
(function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('ghe_payment');
  if (!status) return;

  const clean = () => window.history.replaceState({}, '', window.location.pathname);

  if (status === 'success') {
    window.addEventListener('DOMContentLoaded', () => {
      finalisePaidProperty();
      clean();
    });
  } else if (status === 'cancelled') {
    window.addEventListener('DOMContentLoaded', () => {
      showView('agent-portal');
      toast('Payment cancelled — your property details have been restored.', 'error', 5000);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            const saved = JSON.parse(localStorage.getItem('ghe_pending_property'));
            if (!saved || !saved.title) return;
            restorePostForm(saved);
            toast('Your property details have been restored — review and try again.', 'gold', 5000);
          } catch(e) {}
        });
      });
      clean();
    });
  }
})();

function restorePostForm(saved) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  setVal('pp-title',        saved.title);
  setVal('pp-agent-name',   saved.agent_name);
  setVal('pp-company',      saved.company);
  setVal('pp-email',        saved.email);
  setVal('pp-phone',        saved.phone);
  setVal('pp-website',      saved.website);
  setVal('pp-price',        saved.price);
  setVal('pp-description',  saved.description);
  setVal('pp-map-link',     saved.map_link);
  setVal('pp-logo-url',     saved.logo_url);
  setVal('pp-size',         saved.size);

  const locEl  = document.getElementById('pp-location');
  const typeEl = document.getElementById('pp-listing-type');
  const catEl  = document.getElementById('pp-category');
  const bedsEl = document.getElementById('pp-bedrooms');
  if (locEl  && saved.location)     locEl.value  = saved.location;
  if (typeEl && saved.listing_type) typeEl.value = saved.listing_type;
  if (catEl  && saved.category)     catEl.value  = saved.category;
  if (bedsEl && saved.bedrooms)     bedsEl.value = saved.bedrooms;

  if (saved.amenities && Array.isArray(saved.amenities)) {
    document.querySelectorAll('.amenity-chip').forEach(chip => {
      if (saved.amenities.includes(chip.textContent.trim())) chip.classList.add('selected');
    });
  }

  if (saved.plan) {
    document.querySelectorAll('.plan-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.plan === saved.plan);
    });
  }

  if (saved.photos && saved.photos.length) {
    const photosEl = document.getElementById('pp-photos');
    if (photosEl) photosEl.value = saved.photos.join('\n');
  }

  updatePropertyPreview();
}

async function finalisePaidProperty() {
  showView('agent-portal');

  const pending = (() => {
    try { return JSON.parse(localStorage.getItem('ghe_pending_property')); } catch { return null; }
  })();

  if (!pending || !pending.title) {
    toast('Payment confirmed ✦ Please re-submit your property details below.', 'gold', 8000);
    return;
  }

  pending.featured     = true;
  pending.plan         = pending.plan || 'featured';
  pending.approved     = false;
  pending.submitted_at = pending.submitted_at || new Date().toISOString();
  pending.id           = pending.id || ('paid-' + Date.now());

  const myList = loadRaw(STORAGE_KEYS.agent) || [];
  myList.unshift(pending);
  saveRaw(STORAGE_KEYS.agent, myList);
  localStorage.removeItem('ghe_pending_property');

  updatePortalStats();
  showPaidPropertyWhatsAppScreen(pending);
}

/* ============================================================
   PAID LISTING — WhatsApp submission screen
   ============================================================ */
function showPaidPropertyWhatsAppScreen(payload) {
  document.getElementById('ghe-wa-submit-screen')?.remove();

  const submittedAt = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const planLabel   = payload.plan === 'premium' ? 'PREMIUM — GMD 50 PAID ✅' : 'FEATURED — GMD 25 PAID ✅';

  const waMessage =
    '🏠 *NEW PAID PROPERTY LISTING — GamHub Estate*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '🏢 *AGENT DETAILS*\n' +
    '• Agent: '   + (payload.agent_name || '—') + '\n' +
    '• Agency: '  + (payload.company    || '—') + '\n' +
    '• Email: '   + (payload.email      || '—') + '\n' +
    '• Phone: '   + (payload.phone      || '—') + '\n\n' +
    '🏡 *PROPERTY DETAILS*\n' +
    '• Title: '    + (payload.title        || '—') + '\n' +
    '• Type: '     + (payload.listing_type || '—') + '\n' +
    '• Category: ' + (payload.category     || '—') + '\n' +
    '• Location: ' + (payload.location     || '—') + '\n' +
    '• Price: '    + (payload.price        || '—') + '\n' +
    '• Bedrooms: ' + (payload.bedrooms     || '—') + '\n' +
    '• Plan: '     + planLabel + '\n\n' +
    '📝 *DESCRIPTION*\n' + (payload.description || '—') + '\n\n' +
    '🕐 Submitted: ' + submittedAt;

  const waUrl = 'https://wa.me/2206371941?text=' + encodeURIComponent(waMessage);

  const screen = document.createElement('div');
  screen.id = 'ghe-wa-submit-screen';
  screen.style.cssText =
    'position:fixed;inset:0;z-index:20000;' +
    'background:linear-gradient(160deg,#0c0a08 0%,#0a0e0b 60%,#0c0a08 100%);' +
    'display:flex;align-items:center;justify-content:center;' +
    'padding:24px;flex-direction:column;text-align:center;font-family:Outfit,sans-serif;overflow-y:auto;';

  const card = document.createElement('div');
  card.style.cssText = 'max-width:460px;width:100%;';
  card.innerHTML = `
    <div style="font-size:52px;margin-bottom:16px">🎉</div>
    <div style="display:inline-flex;align-items:center;background:rgba(188,100,60,0.12);border:1px solid rgba(188,100,60,0.3);border-radius:100px;padding:6px 16px;font-size:12px;font-weight:700;color:#d4845a;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:20px;">
      ✅ Payment Confirmed
    </div>
    <h2 style="font-size:26px;font-weight:700;color:#fff;margin:0 0 12px;line-height:1.3;">One last step — submit via WhatsApp</h2>
    <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.75;margin:0 0 28px;">
      Your payment is confirmed ✦ Tap below to send your listing details to GamHub Estate.<br>
      <strong style="color:rgba(255,255,255,0.85);">Your listing goes live within 24 hours.</strong>
    </p>
    <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
      id="ghe-wa-submit-btn"
      style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:18px 24px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-family:Outfit,sans-serif;font-size:16px;font-weight:800;border:none;border-radius:14px;cursor:pointer;text-decoration:none;letter-spacing:0.02em;box-shadow:0 8px 28px rgba(37,211,102,0.4);margin-bottom:14px;box-sizing:border-box;">
      📲 Submit Listing on WhatsApp Now →
    </a>
    <p style="font-size:12px;color:rgba(255,255,255,0.3);margin:0 0 20px;">Opens WhatsApp with your full listing details pre-filled.</p>
    <button id="ghe-wa-skip-btn"
      style="background:none;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.4);border-radius:100px;padding:10px 20px;font-size:13px;cursor:pointer;font-family:Outfit,sans-serif;">
      I already sent it — skip this step
    </button>
  `;

  card.querySelector('#ghe-wa-submit-btn').addEventListener('click', () => {
    setTimeout(() => { screen.remove(); showSuccessState(); }, 500);
  });
  card.querySelector('#ghe-wa-skip-btn').addEventListener('click', () => {
    screen.remove();
    showSuccessState();
  });

  screen.appendChild(card);
  document.body.appendChild(screen);
}

function showSuccessState() {
  const formEl    = document.getElementById('post-property-form');
  const successEl = document.getElementById('submission-success');
  if (formEl)    formEl.style.display = 'none';
  if (successEl) successEl.classList.add('show');
  updatePortalStats();
}

/* ============================================================
   WHATSAPP ADMIN NOTIFICATION (free listings)
   ============================================================ */
function sendPropertyNotificationWhatsApp(payload, plan) {
  try {
    const submittedAt = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const planLabel   = plan === 'free' ? 'FREE LISTING — No payment required' : 'PAID — GMD ' + (MODEMPAY_CONFIG.PRICES[plan] || 0);

    const msg =
      '🏠 *NEW PROPERTY LISTING — GamHub Estate*\n' +
      '━━━━━━━━━━━━━━━━━━━━\n\n' +
      '🏢 *AGENT DETAILS*\n' +
      '• Agent: '   + (payload.agent_name || '—') + '\n' +
      '• Agency: '  + (payload.company    || '—') + '\n' +
      '• Email: '   + (payload.email      || '—') + '\n' +
      '• Phone: '   + (payload.phone      || '—') + '\n' +
      '• Website: ' + (payload.website    || '—') + '\n\n' +
      '🏡 *PROPERTY DETAILS*\n' +
      '• Title: '       + (payload.title        || '—') + '\n' +
      '• Type: '        + (payload.listing_type || '—') + '\n' +
      '• Category: '    + (payload.category     || '—') + '\n' +
      '• Location: '    + (payload.location     || '—') + '\n' +
      '• Street: '      + (payload.street       || '—') + '\n' +
      '• Price: '       + (payload.price        || '—') + '\n' +
      '• Bedrooms: '    + (payload.bedrooms     || '—') + '\n' +
      '• Bathrooms: '   + (payload.bathrooms    || '—') + '\n' +
      '• Size: '        + (payload.size         || '—') + '\n' +
      '• Available: '   + (payload.available    || '—') + '\n' +
      '• Amenities: '   + (Array.isArray(payload.amenities) ? payload.amenities.join(', ') : '—') + '\n' +
      '• Plan: '        + planLabel + '\n\n' +
      '📝 *DESCRIPTION*\n' + (payload.description || '—') + '\n\n' +
      '🔗 *MAP*\n' + (payload.map_link || '—') + '\n\n' +
      '🕐 Submitted: ' + submittedAt;

    const encoded = encodeURIComponent(msg);
    window.location.href = 'https://wa.me/2206371941?text=' + encoded;
  } catch(err) {
    console.error('[WhatsApp notify] Failed:', err);
  }
}

/* ============================================================
   AGENT PORTAL — INIT & MANAGE
   ============================================================ */
function initAgentPortal() {
  sbLoad();
  setAvailableDefault();
  renderManageListings();
  updatePortalStats();
}

function setAvailableDefault() {
  const input = document.getElementById('pp-available');
  if (input && !input.value) {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    input.value = d.toISOString().split('T')[0];
  }
}

function switchPortalTab(tab, btn) {
  document.querySelectorAll('.portal-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.portal-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab)?.classList.add('active');
  if (tab === 'manage') renderManageListings();
}

function renderManageListings() {
  const container = document.getElementById('manage-listings-list');
  if (!container) return;

  const myList = loadRaw(STORAGE_KEYS.agent) || [];

  if (!myList.length) {
    container.innerHTML = `
      <div class="manage-empty">
        <div style="font-size:48px;margin-bottom:16px">🏚️</div>
        <h3>No listings yet</h3>
        <p style="margin-bottom:20px">Your submitted property listings will appear here.</p>
        <button class="btn btn-terracotta" onclick="switchPortalTab('post', document.querySelector('.portal-tab'))">List Your First Property</button>
      </div>`;
    return;
  }

  container.innerHTML = myList.map(prop => {
    const statusClass = prop.approved ? 'status-approved' : (prop.rejected ? 'status-rejected' : 'status-pending');
    const statusLabel = prop.approved ? '✓ Live' : (prop.rejected ? '✗ Rejected' : '⏳ Pending Review');

    return `
      <div class="manage-listing-card">
        <div>
          <div class="manage-listing-title">${h(prop.title)}</div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:6px">${h(prop.agent_name || '')} · ${h(prop.company || '')}</div>
          <div class="manage-listing-meta">
            <span>📍 ${h(prop.location)}</span>
            <span>🏠 ${h(prop.listing_type)}</span>
            ${prop.price ? `<span>💰 ${h(prop.price)}</span>` : ''}
            <span>📋 ${h(prop.plan || 'free')} plan</span>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:8px">
            Submitted: ${new Date(prop.submitted_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            ${prop._local ? ' · <span style="color:var(--gold)">Stored locally</span>' : ' · <span style="color:#4ade80">In database</span>'}
          </div>
        </div>
        <div class="manage-listing-actions">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          <button class="btn btn-ghost btn-sm" onclick="deleteMyListing('${h(prop.id || '')}')">✕ Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function deleteMyListing(id) {
  if (!confirm('Delete this property listing?')) return;
  const myList = (loadRaw(STORAGE_KEYS.agent) || []).filter(p => p.id !== id);
  saveRaw(STORAGE_KEYS.agent, myList);
  renderManageListings();
  updatePortalStats();
  toast('Listing deleted', 'default');
}

function updatePortalStats() {
  const myList  = loadRaw(STORAGE_KEYS.agent) || [];
  const total   = myList.length;
  const active  = myList.filter(p => p.approved).length;
  const pending = myList.filter(p => !p.approved && !p.rejected).length;
  const statTotal   = document.getElementById('stat-total');
  const statActive  = document.getElementById('stat-active');
  const statPending = document.getElementById('stat-pending');
  if (statTotal)   statTotal.textContent   = total;
  if (statActive)  statActive.textContent  = active;
  if (statPending) statPending.textContent = pending;
}

function resetPostForm() {
  const ids = ['pp-title','pp-agent-name','pp-company','pp-email','pp-phone',
                'pp-website','pp-price','pp-description','pp-map-link','pp-logo-url',
                'pp-size','pp-photos','pp-street'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  const selects = ['pp-listing-type','pp-category','pp-location','pp-bedrooms','pp-bathrooms','pp-price-type'];
  selects.forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });

  document.querySelectorAll('.amenity-chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.plan-card').forEach((c, i) => c.classList.toggle('selected', i === 0));

  document.getElementById('post-property-form').style.display = '';
  document.getElementById('submission-success').classList.remove('show');

  setAvailableDefault();
  updatePropertyPreview();
}

/* ============================================================
   SUPABASE INTEGRATION
   ============================================================ */
const supabaseClient = window.supabase
  ? window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY)
  : null;

let SB_CONNECTED = false;

function sbLoad() {
  sbTestConnection();
}

async function sbTestConnection() {
  if (!supabaseClient) return;
  try {
    const res = await fetch(APP_CONFIG.SUPABASE_URL + '/rest/v1/properties?limit=1', {
      headers: { 'apikey': APP_CONFIG.SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + APP_CONFIG.SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(6000),
    });
    SB_CONNECTED = res.ok || res.status === 406;
    if (SB_CONNECTED) console.log('[Supabase] Connected ✓');
  } catch(e) {
    SB_CONNECTED = false;
    console.warn('[Supabase] Could not connect:', e.message);
  }
}

async function sbInsertProperty(property) {
  if (!rateLimiter.check('supabase_write')) {
    throw new Error('Too many requests — please wait ' + rateLimiter.waitSeconds('supabase_write') + 's.');
  }
  const res = await fetch(APP_CONFIG.SUPABASE_URL + '/rest/v1/properties', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        APP_CONFIG.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + APP_CONFIG.SUPABASE_ANON_KEY,
      'Prefer':        'return=representation',
    },
    body: JSON.stringify(property),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err || 'HTTP ' + res.status); }
  return await res.json();
}

/* ============================================================
   AUTH
   ============================================================ */
let currentUser        = null;
let pendingAuthAction  = null;

function initAuth() {
  if (!supabaseClient) {
    updateAuthUI();
    return;
  }

  supabaseClient.auth.onAuthStateChange(function(event, session) {
    currentUser = session ? session.user : null;
    updateAuthUI();
    if (event === 'SIGNED_IN') {
      toast('Signed in as ' + (currentUser.email || 'user') + ' ✦', 'success', 4000);
      closeAuthModal();
      if (pendingAuthAction) {
        const action = pendingAuthAction;
        pendingAuthAction = null;
        setTimeout(action, 400);
      }
    }
    if (event === 'SIGNED_OUT') toast('Signed out successfully', 'default');
  });

  supabaseClient.auth.getSession().then(result => {
    if (result.data?.session) {
      currentUser = result.data.session.user;
    }
    updateAuthUI();
  });
}

function updateAuthUI() {
  const pill        = document.getElementById('nav-user-pill');
  const loginBtn    = document.getElementById('nav-login-btn');
  const avatar      = document.getElementById('nav-user-avatar');
  const emailEl     = document.getElementById('nav-user-email');
  const drawerRow   = document.getElementById('drawer-auth-row');
  const drawerEmail = document.getElementById('drawer-auth-email');
  const drawerLogin = document.getElementById('drawer-login-btn');

  if (currentUser) {
    if (pill)        pill.style.display        = 'flex';
    if (loginBtn)    loginBtn.style.display     = 'none';
    if (emailEl)     emailEl.textContent        = currentUser.email || 'Signed in';
    if (avatar)      avatar.textContent         = (currentUser.email || 'U')[0].toUpperCase();
    if (drawerRow)   drawerRow.style.display    = 'flex';
    if (drawerEmail) drawerEmail.textContent    = currentUser.email || 'Signed in';
    if (drawerLogin) drawerLogin.style.display  = 'none';
  } else {
    if (pill)        pill.style.display         = 'none';
    if (loginBtn)    loginBtn.style.display      = '';
    if (drawerRow)   drawerRow.style.display     = 'none';
    if (drawerLogin) drawerLogin.style.display   = '';
  }
}

function showAuthModal(afterLoginAction) {
  if (typeof afterLoginAction === 'function') pendingAuthAction = afterLoginAction;

  const overlay   = document.getElementById('auth-overlay');
  const stepEmail = document.getElementById('auth-step-email');
  const stepSent  = document.getElementById('auth-step-sent');
  const input     = document.getElementById('auth-email-input');
  const errEl     = document.getElementById('auth-error-msg');

  if (stepEmail) stepEmail.style.display = '';
  if (stepSent)  stepSent.style.display  = 'none';
  if (errEl)     { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (input)     input.value = '';
  if (overlay)   overlay.style.display = 'flex';
  setTimeout(() => { if (input) input.focus(); }, 100);
}

function closeAuthModal() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
}

function handleAuthOverlayClick(event) {
  if (event.target === document.getElementById('auth-overlay')) closeAuthModal();
}

async function sendMagicLink() {
  if (!rateLimiter.check('auth')) {
    const errEl = document.getElementById('auth-error-msg');
    if (errEl) { errEl.textContent = 'Too many attempts — wait ' + rateLimiter.waitSeconds('auth') + 's.'; errEl.style.display = 'block'; }
    return;
  }

  const input   = document.getElementById('auth-email-input');
  const sendBtn = document.getElementById('auth-send-btn');
  const label   = document.getElementById('auth-send-label');
  const errEl   = document.getElementById('auth-error-msg');
  const email   = (input ? input.value : '').trim();

  if (!email || !email.includes('@') || !email.includes('.')) {
    if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; }
    if (input) input.focus();
    return;
  }

  if (errEl)   errEl.style.display = 'none';
  if (sendBtn) sendBtn.disabled    = true;
  if (label)   label.textContent   = '⏳ Sending…';

  if (!supabaseClient) {
    if (errEl) { errEl.textContent = 'Auth is not configured yet. Set up Supabase in APP_CONFIG.'; errEl.style.display = 'block'; }
    if (sendBtn) sendBtn.disabled  = false;
    if (label)   label.textContent = '✉ Send Magic Link';
    return;
  }

  try {
    const redirectTo = window.location.href.split('?')[0].split('#')[0];
    const result     = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (result.error) throw new Error(result.error.message);

    const stepEmail = document.getElementById('auth-step-email');
    const stepSent  = document.getElementById('auth-step-sent');
    const sentEmail = document.getElementById('auth-sent-email');
    if (stepEmail) stepEmail.style.display = 'none';
    if (stepSent)  stepSent.style.display  = 'block';
    if (sentEmail) sentEmail.textContent   = email;
  } catch(err) {
    const msg = err.message || 'Something went wrong. Please try again.';
    if (errEl)   { errEl.textContent = msg; errEl.style.display = 'block'; }
    if (sendBtn) sendBtn.disabled    = false;
    if (label)   label.textContent   = '✉ Send Magic Link';
  }
}

async function authSignOut() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  currentUser = null;
  updateAuthUI();
}

/* ============================================================
   COOKIE CONSENT
   ============================================================ */
const COOKIE_CONSENT_KEY = 'ghe_cookie_consent';

function initCookieBanner() {
  if (localStorage.getItem(COOKIE_CONSENT_KEY)) return;
  setTimeout(() => {
    const banner = document.getElementById('cookie-banner');
    if (banner) { banner.style.display = 'flex'; document.body.classList.add('cookie-visible'); }
  }, 1500);
}

function acceptCookies() {
  localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted-' + Date.now());
  document.body.classList.remove('cookie-visible');
  const banner = document.getElementById('cookie-banner');
  if (banner) {
    banner.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    banner.style.transform  = 'translateY(100%)';
    banner.style.opacity    = '0';
    setTimeout(() => { banner.style.display = 'none'; }, 400);
  }
}

/* ============================================================
   WHATSAPP CHANNEL OVERLAY
   ============================================================ */
const WAC_SESSION_KEY  = 'ghe_wac_shown';
const WAC_CHANNEL_URL  = 'https://whatsapp.com/channel/XXXXXXXXX';
let _wacTimer = null;

function initWACOverlay() {
  if (sessionStorage.getItem(WAC_SESSION_KEY)) return;
  _wacTimer = setTimeout(() => {
    const overlay = document.getElementById('wa-channel-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));
  }, 75000); // 75 seconds
}

function wacJoin() {
  wacDismiss();
  window.open(WAC_CHANNEL_URL, '_blank', 'noopener,noreferrer');
}

function wacDismiss() {
  sessionStorage.setItem(WAC_SESSION_KEY, '1');
  if (_wacTimer) { clearTimeout(_wacTimer); _wacTimer = null; }
  const overlay = document.getElementById('wa-channel-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  setTimeout(() => { overlay.style.display = 'none'; }, 600);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') wacDismiss(); });

/* ============================================================
   SCROLL REVEALS
   ============================================================ */
const scrollRevealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity    = '1';
      entry.target.style.transform  = 'translateY(0)';
      scrollRevealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

function setupScrollReveals() {
  document.querySelectorAll('.bento-card, .how-step, .type-card, .location-chip').forEach(el => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(18px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    scrollRevealObserver.observe(el);
  });
}

/* ============================================================
   DEEP LINK HANDLER — ?property=ID in URL
   ============================================================ */
function handleDeepLink() {
  const params    = new URLSearchParams(window.location.search);
  const propId    = params.get('property');
  if (!propId) return;

  window.history.replaceState({}, '', window.location.pathname);

  const found = getAllProperties().find(p => p.id === propId);
  if (found) {
    showView('search');
    setTimeout(() => openPropertyPage(found), 250);
  } else {
    showView('search');
    toast('Property not found — showing all available listings.', 'default', 4000);
  }
}

/* ============================================================
   PROPERTY SHARE HELPERS
   ============================================================ */
function getPropertyUrl(prop) {
  return window.location.origin + window.location.pathname + '?property=' + (prop.id || slug(prop.title));
}

function sharePropertyWhatsApp(prop) {
  const propUrl = getPropertyUrl(prop);
  const msg = encodeURIComponent(
    '🏠 *Property on GamHub Estate*\n\n' +
    '*' + prop.title + '*\n' +
    '📍 ' + (prop.location || 'The Gambia') + '  |  ' + (prop.listing_type || '') + '\n' +
    (prop.price ? '💰 ' + prop.price + '\n' : '') +
    '\n' + (prop.description || '').slice(0, 160) + (prop.description && prop.description.length > 160 ? '…' : '') + '\n\n' +
    '👉 View full listing: ' + propUrl
  );
  window.open('https://wa.me/?text=' + msg, '_blank', 'noopener,noreferrer');
}

function copyPropertyLink(prop) {
  const propUrl = getPropertyUrl(prop);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(propUrl).then(() => toast('Listing link copied ✓', 'success', 3000));
  } else {
    const ta = document.createElement('textarea');
    ta.value = propUrl; ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    toast('Listing link copied ✓', 'success', 3000);
  }
}

/* ============================================================
   GOOGLE ANALYTICS TRACKING
   ============================================================ */
function _gtag(eventName, params) {
  if (typeof gtag === 'function') gtag('event', eventName, params || {});
}

function trackPropertyView(title)    { _gtag('property_view',    { property_title: title, event_category: 'engagement' }); }
function trackContactAgent(title)    { _gtag('contact_agent',    { property_title: title, event_category: 'conversion' }); }
function trackFreePropertyPost(agent, title) {
  _gtag('property_posted', { plan: 'free', agent, property_title: title, value: 0, currency: 'GMD', event_category: 'agent' });
}
function trackPaidPropertyPost(agent, title, plan, amountGMD) {
  _gtag('purchase', {
    transaction_id: 'prop_' + plan + '_' + Date.now(),
    value: amountGMD, currency: 'GMD',
    items: [{ item_id: 'property_listing_' + plan, item_name: plan + ' Property Listing', price: amountGMD, quantity: 1 }],
  });
}
function trackUserLogin()        { _gtag('login',   { method: 'magic_link', event_category: 'auth' }); }
function trackUserRegistration() { _gtag('sign_up', { method: 'magic_link', event_category: 'auth' }); }
function trackWhatsAppJoin()     { _gtag('whatsapp_channel_join', { event_category: 'growth' }); }
function trackShareUnlockCompleted(type) { _gtag('share_unlock_completed', { unlock_type: type, event_category: 'growth' }); }
function trackSeekerPosted(type) { _gtag('seeker_posted', { listing_type: type, event_category: 'seeker_board' }); }

/* ============================================================
   INIT — DOMContentLoaded
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initCookieBanner();
  initWACOverlay();
  setupScrollReveals();
  sbLoad();
  handleDeepLink();

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  console.log('%c⬡ GamHub Estate — Gambia\'s Property Marketplace', 'color:#bc643c;font-size:14px;font-weight:bold');
});
