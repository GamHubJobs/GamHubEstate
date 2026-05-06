/* ============================================================
   GAMHUB ESTATE — PROPERTY SEEKERS BOARD
   seeker-board.js

   Equivalent of talent-board.js from GamHub Jobs.
   Buyers and renters post what they are looking for.
   Agents browse and contact ready-to-transact prospects.

   Naming convention:
     SB_  → module-level constants / state (Seeker Board)
     sb   → function prefix (seeker board)
     sk   → DOM input IDs (seeker form fields)
   ============================================================ */

/* ============================================================
   SAMPLE SEEKER PROFILES
   ============================================================ */
const SB_SAMPLE_SEEKERS = [
  {
    id: 'seeker-001',
    name: 'Ousman Bojang',
    listing_type: 'For Sale',
    category: 'Villa',
    location_pref: 'Fajara or Bijilo',
    bedrooms: '4',
    budget: 'GMD 4,000,000 – 6,000,000',
    timeline: 'Immediately',
    requirements: 'Must have swimming pool, generator, borehole and compound wall. Prefer sea views or close to the beach. Ready to buy within 30 days — pre-approved financing in place.',
    email: 'ousman.bojang@example.gm',
    phone: '+220 7712345',
    plan: 'featured',
    featured: true,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'seeker-002',
    name: 'Fatou Jallow',
    listing_type: 'For Rent',
    category: 'Apartment',
    location_pref: 'Kololi, Bakau or Fajara',
    bedrooms: '2',
    budget: 'GMD 15,000 – 22,000 / month',
    timeline: 'Immediately',
    requirements: 'Looking for a modern 2-bedroom apartment. Air conditioning essential. Generator or solar backup preferred. Furnished or semi-furnished acceptable. Peaceful neighbourhood, close to schools.',
    email: 'fatou.jallow@example.gm',
    phone: '+220 7654321',
    plan: 'free',
    featured: false,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'seeker-003',
    name: 'Lamin Ceesay',
    listing_type: 'Land',
    category: 'Plot',
    location_pref: 'Brufut, Kerr Serign or Sanyang',
    bedrooms: '',
    budget: 'GMD 600,000 – 1,200,000',
    timeline: '1 Month',
    requirements: 'Looking for a full or half plot with proper documentation (Lease, Site Plan, Permission to Develop). Ready to build immediately after purchase. Prefer Brufut Heights or nearby estate.',
    email: 'lamin.ceesay@example.gm',
    phone: '+220 9923456',
    plan: 'free',
    featured: false,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'seeker-004',
    name: 'Mariama Touray',
    listing_type: 'For Rent',
    category: 'House',
    location_pref: 'Serrekunda or Kanifing',
    bedrooms: '3',
    budget: 'GMD 18,000 – 26,000 / month',
    timeline: '1 Month',
    requirements: 'Three-bedroom house for a family of five. Borehole required — NAWEC supply is not reliable in our area. Compound wall important for children\'s safety. Garden or outdoor space a bonus.',
    email: 'mariama.touray@example.gm',
    phone: '',
    plan: 'free',
    featured: false,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'seeker-005',
    name: 'Ebrima Sanneh',
    listing_type: 'Commercial',
    category: 'Office',
    location_pref: 'Kairaba Avenue or Banjul',
    bedrooms: '',
    budget: 'GMD 35,000 – 60,000 / month',
    timeline: '3 Months',
    requirements: 'Seeking office space of 150–250 sqm for a financial services firm. Ground floor preferred for client access. Must have dedicated parking for at least 4 vehicles. Generator backup and strong internet infrastructure essential.',
    email: 'ebrima.sanneh@example.gm',
    phone: '+220 7891234',
    plan: 'featured',
    featured: true,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'seeker-006',
    name: 'Isatou Camara',
    listing_type: 'For Sale',
    category: 'Compound',
    location_pref: 'Banjul or Bakau',
    bedrooms: '5',
    budget: 'GMD 2,500,000 – 4,000,000',
    timeline: 'Flexible',
    requirements: 'Looking for a large family compound — ideally 5+ bedrooms with boys quarters. Open to older properties that need renovation. Needs to have title deeds in order. Large plot preferred to allow future extension.',
    email: 'isatou.camara@example.gm',
    phone: '+220 7012345',
    plan: 'free',
    featured: false,
    approved: true,
    submitted_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
];

/* ============================================================
   STATE & CONSTANTS
   ============================================================ */
let SB_SEEKERS         = [...SB_SAMPLE_SEEKERS];
let _sbSelectedSeeker  = null;

const SB_STORAGE_KEY   = 'ghe_seeker_profiles';
const SB_ADMIN_WA_NUM  = '2206371941';

const SB_PLAN_PRICES = {
  free:     0,
  featured: 15,   /* GMD */
};

/* ============================================================
   SCROLL LOCK HELPERS
   Prevents background scroll when modals are open
   ============================================================ */
let _sbScrollLockCount = 0;
let _sbSavedScrollY    = 0;

function sbLockScroll() {
  if (_sbScrollLockCount === 0) {
    _sbSavedScrollY              = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top      = '-' + _sbSavedScrollY + 'px';
    document.body.style.width    = '100%';
    document.body.style.overflow = 'hidden';
  }
  _sbScrollLockCount++;
}

function sbUnlockScroll() {
  if (_sbScrollLockCount <= 0) return;
  _sbScrollLockCount--;
  if (_sbScrollLockCount === 0) {
    document.body.style.position = '';
    document.body.style.top      = '';
    document.body.style.width    = '';
    document.body.style.overflow = '';
    window.scrollTo(0, _sbSavedScrollY);
  }
}

function sbForceUnlockScroll() {
  _sbScrollLockCount           = 0;
  document.body.style.position = '';
  document.body.style.top      = '';
  document.body.style.width    = '';
  document.body.style.overflow = '';
}

/* ============================================================
   UTILITIES
   ============================================================ */
function sbEsc(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
function sbSanitize(val, max) {
  return String(val || '').trim().slice(0, max || 500);
}
function sbSanitizeUrl(val) {
  const s = String(val || '').trim();
  return /^https?:\/\//i.test(s) ? s.slice(0, 500) : '';
}
function sbSanitizeEmail(val) {
  const s = String(val || '').trim().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}
function sbToast(msg, type, duration) {
  if (typeof toast === 'function') toast(msg, type || 'default', duration || 3500);
  else console.log('[SeekerBoard]', msg);
}
function sbTimeAgo(iso) {
  if (!iso) return '';
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (days  > 0) return days  + 'd ago';
  if (hours > 0) return hours + 'h ago';
  if (mins  > 0) return mins  + 'm ago';
  return 'Just now';
}

/* ============================================================
   AVATAR INITIAL HELPER
   ============================================================ */
function sbGetAvatarHTML(seeker, size) {
  const sz       = size || 50;
  const initials = (seeker.name || 'XX').split(' ')
    .slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');
  return `
    <div class="sb-avatar" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * 0.36)}px"
         aria-label="${sbEsc(seeker.name || 'Buyer')} avatar">
      ${initials}
    </div>`;
}

/* ============================================================
   PLAN HELPERS
   ============================================================ */
function sbGetSelectedPlan() {
  return document.querySelector('.sb-plan-card.selected')?.dataset?.plan || 'free';
}

function sbSelectPlan(card, plan) {
  document.querySelectorAll('.sb-plan-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  card.dataset.plan = plan;

  const btn    = document.getElementById('sk-submit-btn');
  const noteEl = document.getElementById('sk-submit-note');

  const labels = {
    free:     '✦ Post My Requirements Free',
    featured: '💳 Pay GMD ' + SB_PLAN_PRICES.featured + ' — Post Featured Profile',
  };
  const notes = {
    free:     'Free · Visible to verified Gambian agents and sellers',
    featured: 'You will be redirected to ModemPay to complete payment in GMD.',
  };

  if (btn)    btn.textContent    = labels[plan] || labels.free;
  if (noteEl) noteEl.textContent = notes[plan]  || notes.free;
}

/* ============================================================
   INIT
   ============================================================ */
function initSeekerBoard() {
  sbForceUnlockScroll();
  sbLoadLocalSeekers();
  sbRenderSeekers(SB_SEEKERS);
}

/* ============================================================
   LOAD LOCALLY SUBMITTED SEEKER PROFILES
   ============================================================ */
function sbLoadLocalSeekers() {
  try {
    const local    = JSON.parse(localStorage.getItem(SB_STORAGE_KEY) || '[]');
    const approved = local.filter(s => s.approved !== false);
    const featured = approved.filter(s => s.featured);
    const standard = approved.filter(s => !s.featured);
    SB_SEEKERS     = [...featured, ...standard, ...SB_SAMPLE_SEEKERS];
  } catch(e) {
    SB_SEEKERS = [...SB_SAMPLE_SEEKERS];
  }
}

function sbSaveLocalSeeker(seeker) {
  try {
    const existing = JSON.parse(localStorage.getItem(SB_STORAGE_KEY) || '[]');
    existing.unshift(seeker);
    localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(existing));
  } catch(e) {}
}

/* ============================================================
   FILTER
   ============================================================ */
function sbFilterSeekers() {
  const kw       = (document.getElementById('sb-keyword')?.value  || '').toLowerCase().trim();
  const type     = document.getElementById('sb-type')?.value      || '';
  const timeline = document.getElementById('sb-timeline')?.value  || '';

  const filtered = SB_SEEKERS.filter(s => {
    const inText = !kw ||
      (s.name          || '').toLowerCase().includes(kw) ||
      (s.location_pref || '').toLowerCase().includes(kw) ||
      (s.category      || '').toLowerCase().includes(kw) ||
      (s.requirements  || '').toLowerCase().includes(kw) ||
      (s.listing_type  || '').toLowerCase().includes(kw);

    const inType     = !type     || s.listing_type === type;
    const inTimeline = !timeline || s.timeline      === timeline;

    return inText && inType && inTimeline;
  });

  sbRenderSeekers(filtered);
}

/* ============================================================
   RENDER SEEKER GRID
   Featured seekers always appear first
   ============================================================ */
function sbRenderSeekers(list) {
  const grid  = document.getElementById('sb-seeker-grid');
  const empty = document.getElementById('sb-empty');
  const meta  = document.getElementById('sb-result-meta');
  if (!grid) return;

  grid.innerHTML = '';

  const sorted = [
    ...list.filter(s => s.featured),
    ...list.filter(s => !s.featured),
  ];

  if (!sorted.length) {
    grid.style.display = 'none';
    if (empty) empty.style.display = '';
    if (meta)  meta.innerHTML = 'Showing <strong>0</strong> seekers';
    return;
  }

  grid.style.display = '';
  if (empty) empty.style.display = 'none';
  if (meta)  meta.innerHTML =
    'Showing <strong>' + sorted.length + '</strong> of <strong>' + SB_SEEKERS.length + '</strong> property seekers';

  sorted.forEach(seeker => grid.appendChild(sbCreateCard(seeker)));
}

/* ============================================================
   CREATE SEEKER CARD
   ============================================================ */
function sbCreateCard(seeker) {
  const card = document.createElement('div');
  card.className = 'sb-card' + (seeker.featured ? ' sb-card-featured' : '');
  card.addEventListener('click', () => sbOpenSeekerPage(seeker));
  card.style.cursor = 'pointer';

  /* Timeline badge class */
  const timelineClass = {
    'Immediately': 'timeline-now',
    '1 Month':     'timeline-month',
    '3 Months':    'timeline-three',
    'Flexible':    'timeline-flex',
  }[seeker.timeline] || 'timeline-flex';

  /* Listing type label */
  const typeLabel = {
    'For Sale':   '🏡 To Buy',
    'For Rent':   '🔑 To Rent',
    'Commercial': '🏢 Commercial',
    'Land':       '📐 Land',
  }[seeker.listing_type] || seeker.listing_type || 'Seeking';

  const postedAgo = sbTimeAgo(seeker.submitted_at);

  card.innerHTML = `
    ${seeker.featured
      ? '<div style="margin-bottom:10px"><span class="sb-plan-badge-featured">⭐ Featured Seeker</span></div>'
      : ''}
    <div class="sb-card-head">
      ${sbGetAvatarHTML(seeker, 50)}
      <div class="sb-card-info">
        <h3 class="sb-card-name">${sbEsc(seeker.name)}</h3>
        <div class="sb-card-seek-type">${sbEsc(typeLabel)}${seeker.category ? ' · ' + sbEsc(seeker.category) : ''}</div>
      </div>
      <div class="sb-timeline-badge ${timelineClass}">${sbEsc(seeker.timeline || 'Flexible')}</div>
    </div>
    <div class="sb-card-meta">
      ${seeker.location_pref ? `<span class="sb-meta-item">📍 ${sbEsc(seeker.location_pref)}</span>` : ''}
      ${seeker.bedrooms      ? `<span class="sb-meta-item">🛏 ${sbEsc(seeker.bedrooms)} Bed${seeker.bedrooms === '1' ? '' : 's'}+</span>` : ''}
      ${seeker.category      ? `<span class="sb-meta-item">🏠 ${sbEsc(seeker.category)}</span>` : ''}
    </div>
    ${seeker.budget ? `<div class="sb-card-budget">${sbEsc(seeker.budget)}</div>` : ''}
    ${seeker.requirements
      ? `<p class="sb-card-requirements">${sbEsc(seeker.requirements)}</p>`
      : ''}
    <div class="sb-card-footer">
      <span class="sb-posted-ago">${postedAgo}</span>
      <div class="sb-card-actions">
        <button class="sb-btn-view"
          onclick="event.stopPropagation();sbOpenSeekerPage(SB_SEEKERS.find(s=>s.id==='${sbEsc(seeker.id)}'))">
          View →
        </button>
        <button class="sb-btn-contact"
          onclick="event.stopPropagation();sbContactSeeker('${sbEsc(seeker.id)}')">
          Contact →
        </button>
      </div>
    </div>
  `;

  return card;
}

/* ============================================================
   OPEN SEEKER FULL PAGE VIEW
   Mirrors openPropertyPage() pattern from script.js
   ============================================================ */
function sbOpenSeekerPage(seeker) {
  if (!seeker) return;
  _sbSelectedSeeker = seeker;

  /* ── Avatar ── */
  const avatarEl = document.getElementById('sp-profile-avatar');
  if (avatarEl) {
    const initials = (seeker.name || 'XX').split(' ')
      .slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');
    avatarEl.textContent = initials;
  }

  /* ── Name & seek type ── */
  const nameEl = document.getElementById('sp-profile-name');
  const roleEl = document.getElementById('sp-profile-seek-type');
  const typeLabel = {
    'For Sale':   '🏡 Looking to Buy',
    'For Rent':   '🔑 Looking to Rent',
    'Commercial': '🏢 Seeking Commercial Space',
    'Land':       '📐 Looking for Land',
  }[seeker.listing_type] || 'Property Seeker';

  if (nameEl) nameEl.textContent = seeker.name || '';
  if (roleEl) roleEl.textContent = typeLabel + (seeker.category ? ' · ' + seeker.category : '');

  /* ── Chips row ── */
  const timelineClass = {
    'Immediately': 'sp-chip-type-buy',
    '1 Month':     'sp-chip-timeline',
    '3 Months':    'sp-chip-timeline',
    'Flexible':    'sp-chip-timeline',
  }[seeker.timeline] || 'sp-chip-timeline';

  const typeChipClass = {
    'For Sale':   'sp-chip-type-buy',
    'For Rent':   'sp-chip-type-rent',
    'Commercial': 'sp-chip-type-comm',
    'Land':       'sp-chip-type-land',
  }[seeker.listing_type] || 'sp-chip-type-buy';

  const chipsEl = document.getElementById('sp-profile-chips');
  if (chipsEl) chipsEl.innerHTML = [
    seeker.listing_type && `<span class="sp-chip ${typeChipClass}">🏠 ${sbEsc(typeLabel)}</span>`,
    seeker.budget       && `<span class="sp-chip sp-chip-budget">💰 ${sbEsc(seeker.budget)}</span>`,
    seeker.timeline     && `<span class="sp-chip sp-chip-timeline">⏱ ${sbEsc(seeker.timeline)}</span>`,
    seeker.bedrooms     && `<span class="sp-chip sp-chip-beds">🛏 ${sbEsc(seeker.bedrooms)} Bed+</span>`,
    seeker.featured     && `<span class="sp-chip" style="background:rgba(201,169,110,0.12);border:1px solid rgba(201,169,110,0.35);color:var(--gold2)">⭐ Featured</span>`,
  ].filter(Boolean).join('');

  /* ── Details grid ── */
  const detailItems = [
    { label: 'Looking to',       value: typeLabel                },
    { label: 'Property Type',    value: seeker.category          },
    { label: 'Preferred Areas',  value: seeker.location_pref     },
    { label: 'Min. Bedrooms',    value: seeker.bedrooms ? seeker.bedrooms + '+' : null },
    { label: 'Budget',           value: seeker.budget            },
    { label: 'Timeline',         value: seeker.timeline          },
  ].filter(i => i.value);

  const detailsGrid = document.getElementById('sp-profile-details-grid');
  if (detailsGrid) detailsGrid.innerHTML = detailItems.map(i => `
    <div>
      <div class="sp-detail-label">${sbEsc(i.label)}</div>
      <div class="sp-detail-value">${sbEsc(i.value)}</div>
    </div>
  `).join('');

  const secDetails = document.getElementById('sp-profile-sec-details');
  if (secDetails) secDetails.style.display = detailItems.length ? '' : 'none';

  /* ── Requirements ── */
  const reqEl    = document.getElementById('sp-profile-requirements');
  const secReq   = document.getElementById('sp-profile-sec-requirements');
  if (reqEl) reqEl.textContent = seeker.requirements || '';
  if (secReq) secReq.style.display = seeker.requirements ? '' : 'none';

  /* ── Contact actions ── */
  const actionsEl = document.getElementById('sp-profile-actions');
  if (actionsEl) {
    actionsEl.innerHTML = '';

    if (seeker.email) {
      const emailBtn = document.createElement('button');
      emailBtn.className   = 'sp-contact-btn sp-contact-email';
      emailBtn.textContent = '✉ Send Email →';
      emailBtn.addEventListener('click', () => sbContactSeeker(seeker.id));
      actionsEl.appendChild(emailBtn);
    }

    if (seeker.phone) {
      const waBtn       = document.createElement('a');
      waBtn.className   = 'sp-contact-btn sp-contact-whatsapp';
      waBtn.textContent = '💬 WhatsApp →';
      waBtn.href        = 'https://wa.me/' + seeker.phone.replace(/[^0-9]/g, '') +
        '?text=' + encodeURIComponent(
          'Hello ' + (seeker.name || '') + ', I found your property requirements on GamHub Estate ' +
          'and I may have a property matching what you\'re looking for.'
        );
      waBtn.target = '_blank';
      waBtn.rel    = 'noopener noreferrer';
      actionsEl.appendChild(waBtn);
    }

    const backBtn = document.createElement('button');
    backBtn.className   = 'sp-contact-btn sp-contact-ghost';
    backBtn.textContent = '← Back to Seekers';
    backBtn.addEventListener('click', sbCloseProfilePage);
    actionsEl.appendChild(backBtn);
  }

  /* ── Navigate ── */
  if (typeof showView === 'function') showView('seeker-profile');
}

/* ============================================================
   CLOSE PROFILE PAGE
   ============================================================ */
function sbCloseProfilePage() {
  _sbSelectedSeeker = null;
  if (typeof showView === 'function') showView('seeker-board');
}

/* ============================================================
   CONTACT SEEKER (email)
   ============================================================ */
function sbContactSeeker(id) {
  const seeker = SB_SEEKERS.find(s => String(s.id) === String(id));
  if (!seeker || !seeker.email) {
    sbToast('No contact email available for this seeker.', 'error');
    return;
  }

  if (typeof trackContactAgent === 'function') trackContactAgent('Seeker: ' + (seeker.name || id));

  const subject = encodeURIComponent('Property Match via GamHub Estate — ' + (seeker.category || seeker.listing_type || 'Property'));
  const body    = encodeURIComponent(
    'Hello ' + (seeker.name || 'there') + ',\n\n' +
    'I found your property requirements on GamHub Estate and I believe I have a listing ' +
    'that may match what you are looking for.\n\n' +
    'Could we connect at your earliest convenience?\n\n' +
    'Kind regards'
  );
  window.location.href = 'mailto:' + seeker.email + '?subject=' + subject + '&body=' + body;
}

/* ============================================================
   SHOW POST FORM — navigates to the seeker-board view and opens modal
   ============================================================ */
function sbShowPostForm() {
  if (typeof currentUser !== 'undefined' && !currentUser) {
    if (typeof showAuthModal === 'function') {
      showAuthModal(() => sbShowPostForm());
      return;
    }
  }

  /* Reset success state, show form */
  const formEl    = document.getElementById('sb-post-form');
  const successEl = document.getElementById('sb-post-success');
  if (formEl)    formEl.style.display    = '';
  if (successEl) successEl.style.display = 'none';

  /* Reset plan to free */
  document.querySelectorAll('.sb-plan-card').forEach((c, i) => {
    c.classList.toggle('selected', i === 0);
    if (i === 0) c.dataset.plan = 'free';
  });

  const btn    = document.getElementById('sk-submit-btn');
  const noteEl = document.getElementById('sk-submit-note');
  if (btn)    btn.textContent    = '✦ Post My Requirements Free';
  if (noteEl) noteEl.textContent = 'Free · Visible to verified Gambian agents and sellers';

  /* Open modal */
  const backdrop = document.getElementById('sb-post-backdrop');
  if (backdrop) {
    backdrop.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('sb-open')));
    sbLockScroll();
  }

  /* Free listing count hint */
  requestAnimationFrame(() => {
    const noteElInner = document.getElementById('sk-submit-note');
    if (noteElInner && typeof freeListingCountRemaining === 'function') {
      const remaining = freeListingCountRemaining('seeker');
      const plan      = sbGetSelectedPlan();
      if ((SB_PLAN_PRICES[plan] || 0) === 0 && remaining <= 2) {
        noteElInner.textContent =
          'Free · ' + remaining + ' free profile' + (remaining === 1 ? '' : 's') + ' remaining this week';
      }
    }
  });
}

/* ============================================================
   CLOSE POST FORM MODAL
   ============================================================ */
function sbClosePostForm() {
  const backdrop = document.getElementById('sb-post-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('sb-open');
  sbUnlockScroll();
  setTimeout(() => { backdrop.style.display = 'none'; }, 350);
}

/* ============================================================
   SUBMIT SEEKER PROFILE
   ============================================================ */
function sbSubmitSeeker() {
  /* Collect & validate */
  const name      = document.getElementById('sk-name')?.value.trim()         || '';
  const email     = document.getElementById('sk-email')?.value.trim()        || '';
  const listType  = document.getElementById('sk-listing-type')?.value        || '';
  const location  = document.getElementById('sk-location')?.value.trim()     || '';
  const budget    = document.getElementById('sk-budget')?.value.trim()       || '';
  const timeline  = document.getElementById('sk-timeline')?.value            || 'Flexible';

  if (!name)                          { sbToast('Please enter your name', 'error');                    return; }
  if (!email || !email.includes('@')) { sbToast('Please enter a valid email address', 'error');        return; }
  if (!listType)                      { sbToast('Please select what you are looking for', 'error');    return; }
  if (!location)                      { sbToast('Please enter your preferred location(s)', 'error');   return; }
  if (!budget)                        { sbToast('Please enter your budget', 'error');                  return; }

  /* Rate limit check for free plans */
  const plan   = sbGetSelectedPlan();
  const amount = SB_PLAN_PRICES[plan] || 0;

  if (amount === 0) {
    if (typeof freeListingCountRemaining === 'function') {
      const remaining = freeListingCountRemaining('seeker');
      if (remaining <= 0) {
        if (typeof freeListingShowLimitMessage === 'function') freeListingShowLimitMessage('seeker');
        return;
      }
      if (remaining === 1) {
        sbToast('Heads up — this is your last free seeker profile for the next 7 days.', 'gold', 5000);
      }
    }
  }

  /* Build unique stable token */
  const token = 'sk-' + name.toLowerCase().replace(/\s+/g, '-').slice(0, 12) + '-' + Math.floor(Date.now() / 1000);

  const payload = {
    id:           token,
    name:         sbSanitize(name, 100),
    email:        sbSanitizeEmail(email) || '',
    phone:        sbSanitize(document.getElementById('sk-phone')?.value.trim() || '', 40),
    listing_type: sbSanitize(listType, 40),
    category:     sbSanitize(document.getElementById('sk-category')?.value || '', 60),
    location_pref:sbSanitize(location, 200),
    bedrooms:     sbSanitize(document.getElementById('sk-bedrooms')?.value || '', 20),
    budget:       sbSanitize(budget, 100),
    timeline:     sbSanitize(timeline, 40),
    requirements: sbSanitize(document.getElementById('sk-requirements')?.value.trim() || '', 1000),
    plan:         plan,
    featured:     plan === 'featured',
    approved:     true,
    submitted_at: new Date().toISOString(),
  };

  if (amount > 0) {
    sbSubmitFeaturedPayment(payload, amount);
  } else {
    sbFinaliseProfileSubmit(payload);
  }
}

/* ============================================================
   FEATURED PAYMENT — redirect to ModemPay
   ============================================================ */
function sbSubmitFeaturedPayment(payload, amount) {
  if (typeof rateLimiter !== 'undefined' && !rateLimiter.check('payment')) {
    sbToast('Too many payment attempts — please wait ' + rateLimiter.waitSeconds('payment') + 's.', 'error', 5000);
    return;
  }

  /* Persist payload before redirect */
  try {
    localStorage.setItem('ghe_pending_seeker', JSON.stringify(payload));
    const verify = JSON.parse(localStorage.getItem('ghe_pending_seeker'));
    if (!verify || !verify.name) { sbToast('Could not save your details. Please try again.', 'error', 5000); return; }
  } catch(e) { sbToast('Storage error. Please try again.', 'error', 5000); return; }

  const base      = window.location.origin + window.location.pathname;
  const returnUrl = base + '?sb_payment=success&sb_token=' + encodeURIComponent(payload.id);
  const cancelUrl = base + '?sb_payment=cancelled';
  const mpTrim    = (v, max) => String(v || '').trim().slice(0, max || 255);

  const pubKey = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.MODEMPAY_PUBLIC_KEY : '';

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://checkout.modempay.com/api/pay';
  form.style.display = 'none';

  const fields = {
    public_key:     mpTrim(pubKey, 255),
    amount:         mpTrim(String(amount), 20),
    currency:       'GMD',
    customer_name:  mpTrim(payload.name  || 'GamHub Estate User', 100),
    customer_email: mpTrim(payload.email || 'user@gamhubestate.gm', 100),
    customer_phone: '7000000',
    return_url:     mpTrim(returnUrl, 255),
    cancel_url:     mpTrim(cancelUrl, 255),
    'metadata[source]':   'gamhubestate-seeker',
    'metadata[plan]':     'featured',
    'metadata[sb_token]': mpTrim(payload.id, 80),
  };

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type  = 'hidden';
    input.name  = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  sbToast('Redirecting to ModemPay… GMD ' + amount, 'gold', 2000);
  setTimeout(() => form.submit(), 600);
}

/* ============================================================
   FINALISE SEEKER PROFILE (after share gate or free submit)
   ============================================================ */
function sbFinaliseProfileSubmit(payload) {
  sbSaveLocalSeeker(payload);
  sbLoadLocalSeekers();

  /* Record usage for free listings */
  if ((payload.plan || 'free') === 'free') {
    if (typeof freeListingRecordUsage === 'function') freeListingRecordUsage('seeker');
  }

  /* Analytics */
  if (typeof trackSeekerPosted === 'function') trackSeekerPosted(payload.listing_type);

  /* Show success in modal */
  const formEl    = document.getElementById('sb-post-form');
  const successEl = document.getElementById('sb-post-success');
  if (formEl)    formEl.style.display    = 'none';
  if (successEl) successEl.style.display = '';

  /* Send admin WhatsApp notification */
  setTimeout(() => sbSendAdminNotification(payload), 600);

  sbRenderSeekers(SB_SEEKERS);
  sbToast('Profile posted! Agents can now find and contact you ✦', 'success', 5000);
}

/* ============================================================
   PAYMENT RETURN HANDLER
   Triggered when user returns from ModemPay for featured seeker
   ============================================================ */
(function sbCheckPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('sb_payment');
  if (!status) return;

  window._sbPaymentStatus = status;
  window.history.replaceState({}, '', window.location.pathname);
})();

function sbHandlePaymentReturn() {
  const status = window._sbPaymentStatus;
  if (!status) return;

  if (status === 'success') {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem('ghe_pending_seeker')); } catch(e) {}

    if (!pending || !pending.name) {
      if (typeof showView === 'function') showView('seeker-board');
      sbToast('Payment confirmed ✦ Please re-submit your requirements below.', 'gold', 8000);
      sbShowPostForm();
      return;
    }

    pending.featured     = true;
    pending.plan         = 'featured';
    pending.approved     = true;
    pending.submitted_at = pending.submitted_at || new Date().toISOString();
    localStorage.removeItem('ghe_pending_seeker');

    sbSaveLocalSeeker(pending);
    sbLoadLocalSeekers();

    if (typeof trackSeekerPosted === 'function') trackSeekerPosted(pending.listing_type);

    if (typeof showView === 'function') showView('seeker-board');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      sbRenderSeekers(SB_SEEKERS);
      sbShowFeaturedWhatsAppScreen(pending);
    }));

  } else if (status === 'cancelled') {
    if (typeof showView === 'function') showView('seeker-board');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('ghe_pending_seeker'));
        if (!saved) return;
        sbShowPostForm();
        sbRestoreForm(saved);
        sbToast('Payment cancelled — your details have been restored.', 'gold', 5000);
      } catch(e) {
        sbToast('Payment cancelled.', 'error', 4000);
      }
    }));
  }
}

function sbRestoreForm(saved) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  setVal('sk-name',         saved.name);
  setVal('sk-email',        saved.email);
  setVal('sk-phone',        saved.phone);
  setVal('sk-location',     saved.location_pref);
  setVal('sk-budget',       saved.budget);
  setVal('sk-requirements', saved.requirements);

  const typeEl     = document.getElementById('sk-listing-type');
  const catEl      = document.getElementById('sk-category');
  const bedsEl     = document.getElementById('sk-bedrooms');
  const timelineEl = document.getElementById('sk-timeline');
  if (typeEl     && saved.listing_type)  typeEl.value     = saved.listing_type;
  if (catEl      && saved.category)      catEl.value      = saved.category;
  if (bedsEl     && saved.bedrooms)      bedsEl.value     = saved.bedrooms;
  if (timelineEl && saved.timeline)      timelineEl.value = saved.timeline;
}

/* ============================================================
   FEATURED SEEKER — WhatsApp submission screen
   Mirrors showPaidPropertyWhatsAppScreen() from script.js
   ============================================================ */
function sbShowFeaturedWhatsAppScreen(payload) {
  document.getElementById('ghe-sb-wa-screen')?.remove();

  const submittedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const waMessage =
    '🔍 *NEW FEATURED SEEKER PROFILE — GamHub Estate*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '👤 *SEEKER DETAILS*\n' +
    '• Name: '         + (payload.name          || '—') + '\n' +
    '• Email: '        + (payload.email         || '—') + '\n' +
    '• Phone: '        + (payload.phone         || '—') + '\n\n' +
    '🏠 *REQUIREMENTS*\n' +
    '• Looking to: '   + (payload.listing_type  || '—') + '\n' +
    '• Type: '         + (payload.category      || '—') + '\n' +
    '• Location: '     + (payload.location_pref || '—') + '\n' +
    '• Bedrooms: '     + (payload.bedrooms      || '—') + '\n' +
    '• Budget: '       + (payload.budget        || '—') + '\n' +
    '• Timeline: '     + (payload.timeline      || '—') + '\n' +
    '• Plan: FEATURED (GMD ' + SB_PLAN_PRICES.featured + ' — PAID ✅)\n\n' +
    '📝 *DETAILS*\n' + (payload.requirements    || '—') + '\n\n' +
    '🕐 Submitted: '   + submittedAt;

  const waUrl = 'https://wa.me/' + SB_ADMIN_WA_NUM + '?text=' + encodeURIComponent(waMessage);

  const screen = document.createElement('div');
  screen.id = 'ghe-sb-wa-screen';
  screen.style.cssText =
    'position:fixed;inset:0;z-index:20000;' +
    'background:linear-gradient(160deg,#0c0a08 0%,#0a0e0b 60%,#0c0a08 100%);' +
    'display:flex;align-items:center;justify-content:center;' +
    'padding:24px;flex-direction:column;text-align:center;font-family:Outfit,sans-serif;overflow-y:auto;';

  const card = document.createElement('div');
  card.style.cssText = 'max-width:460px;width:100%;';
  card.innerHTML = `
    <div style="font-size:52px;margin-bottom:16px">🎉</div>
    <div style="display:inline-flex;align-items:center;background:rgba(201,169,110,0.12);border:1px solid rgba(201,169,110,0.3);border-radius:100px;padding:6px 16px;font-size:12px;font-weight:700;color:#e2c98a;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:20px;">
      ⭐ Featured Seeker — Payment Confirmed
    </div>
    <h2 style="font-size:26px;font-weight:700;color:#fff;margin:0 0 12px;line-height:1.3;">One last step — confirm via WhatsApp</h2>
    <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.75;margin:0 0 28px;">
      Payment confirmed ✦ Tap below to send your profile to GamHub Estate.<br>
      <strong style="color:rgba(255,255,255,0.85);">Your featured profile goes live within 24 hours.</strong>
    </p>
    <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
      style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:18px 24px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-family:Outfit,sans-serif;font-size:16px;font-weight:800;border:none;border-radius:14px;cursor:pointer;text-decoration:none;letter-spacing:0.02em;box-shadow:0 8px 28px rgba(37,211,102,0.4);margin-bottom:14px;box-sizing:border-box;"
      id="ghe-sb-wa-btn">
      📲 Submit Profile on WhatsApp Now →
    </a>
    <p style="font-size:12px;color:rgba(255,255,255,0.3);margin:0 0 20px;">Opens WhatsApp with your full profile details pre-filled.</p>
    <button id="ghe-sb-wa-skip"
      style="background:none;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.4);border-radius:100px;padding:10px 20px;font-size:13px;cursor:pointer;font-family:Outfit,sans-serif;">
      I already sent it — skip this step
    </button>
  `;

  card.querySelector('#ghe-sb-wa-btn').addEventListener('click', () => { setTimeout(() => screen.remove(), 500); });
  card.querySelector('#ghe-sb-wa-skip').addEventListener('click', () => screen.remove());

  screen.appendChild(card);
  document.body.appendChild(screen);
}

/* ============================================================
   ADMIN WHATSAPP NOTIFICATION (free listings)
   ============================================================ */
function sbSendAdminNotification(payload) {
  try {
    const submittedAt = new Date().toLocaleString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const planLabel = payload.plan === 'featured'
      ? 'FEATURED (GMD ' + SB_PLAN_PRICES.featured + ' — PAID)'
      : 'FREE';

    const msg =
      '🔍 *NEW SEEKER PROFILE — GamHub Estate*\n' +
      '━━━━━━━━━━━━━━━━━━━━\n\n' +
      '👤 *SEEKER DETAILS*\n' +
      '• Name: '         + (payload.name          || '—') + '\n' +
      '• Email: '        + (payload.email         || '—') + '\n' +
      '• Phone: '        + (payload.phone         || '—') + '\n\n' +
      '🏠 *REQUIREMENTS*\n' +
      '• Looking to: '   + (payload.listing_type  || '—') + '\n' +
      '• Type: '         + (payload.category      || '—') + '\n' +
      '• Location: '     + (payload.location_pref || '—') + '\n' +
      '• Bedrooms: '     + (payload.bedrooms      || '—') + '\n' +
      '• Budget: '       + (payload.budget        || '—') + '\n' +
      '• Timeline: '     + (payload.timeline      || '—') + '\n' +
      '• Plan: '         + planLabel + '\n\n' +
      '📝 *DETAILS*\n' + (payload.requirements    || '—') + '\n\n' +
      '🕐 Submitted: '   + submittedAt;

    const encoded = encodeURIComponent(msg);
    window.open('https://wa.me/' + SB_ADMIN_WA_NUM + '?text=' + encoded, '_blank', 'noopener,noreferrer');
  } catch(err) {
    console.warn('[SeekerBoard] Admin notification failed:', err);
  }
}

/* ============================================================
   SEEKER PROFILE SHARE HELPERS
   ============================================================ */
function sbGetProfileUrl(id) {
  return window.location.origin + window.location.pathname + '?seeker=' + encodeURIComponent(id);
}

function sbShareProfileWhatsApp(seeker, profileUrl) {
  const typeLabel = {
    'For Sale': 'looking to buy', 'For Rent': 'looking to rent',
    'Commercial': 'seeking commercial space', 'Land': 'looking for land',
  }[seeker.listing_type] || 'looking for property';

  const msg = encodeURIComponent(
    '🔍 *Property Seeker on GamHub Estate*\n\n' +
    '*' + seeker.name + '*\n' +
    typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1) +
    (seeker.category ? ' · ' + seeker.category : '') + '\n' +
    '📍 ' + (seeker.location_pref || 'The Gambia') + '\n' +
    (seeker.budget ? '💰 Budget: ' + seeker.budget + '\n' : '') +
    (seeker.timeline ? '⏱ Timeline: ' + seeker.timeline + '\n' : '') +
    '\n' + (seeker.requirements || '').slice(0, 150) +
    (seeker.requirements && seeker.requirements.length > 150 ? '…' : '') +
    '\n\n👉 View full profile: ' + profileUrl
  );
  window.open('https://wa.me/?text=' + msg, '_blank', 'noopener,noreferrer');
}

function sbCopyProfileLink(profileUrl, itemEl) {
  const label = itemEl?.querySelector('.js-share-item-label');
  const doFeedback = () => {
    if (label) {
      const orig = label.textContent;
      label.textContent = 'Copied! ✓';
      setTimeout(() => { label.textContent = orig; }, 1500);
    }
    sbToast('Profile link copied ✓', 'success', 3000);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(profileUrl).then(doFeedback).catch(() => sbLegacyCopy(profileUrl, doFeedback));
  } else {
    sbLegacyCopy(profileUrl, doFeedback);
  }
}

function sbLegacyCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
  if (cb) cb();
}

/* ============================================================
   DEEP LINK HANDLER — ?seeker=ID in URL
   ============================================================ */
function sbHandleDeepLink() {
  const params   = new URLSearchParams(window.location.search);
  const seekerId = params.get('seeker');
  if (!seekerId) return;

  window.history.replaceState({}, '', window.location.pathname);

  sbLoadLocalSeekers();
  const found = SB_SEEKERS.find(s => String(s.id) === String(seekerId));
  if (found) {
    if (typeof showView === 'function') showView('seeker-board');
    setTimeout(() => sbOpenSeekerPage(found), 300);
  } else {
    if (typeof showView === 'function') showView('seeker-board');
    sbToast('Seeker profile not found — showing all profiles.', 'default', 4000);
  }
}

/* ============================================================
   HOOK INTO showView() — safety net to always unlock scroll
   and reinitialise when the seeker board is activated
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  /* Wire up back button on seeker profile page */
  const backBtn = document.getElementById('sp-profile-back-btn');
  if (backBtn) backBtn.addEventListener('click', sbCloseProfilePage);

  /* Patch showView to intercept seeker-board and seeker-profile */
  const _originalShowView = window.showView;
  window.showView = function(id) {
    sbForceUnlockScroll();
    if (typeof _originalShowView === 'function') _originalShowView(id);
    if (id === 'seeker-board') {
      requestAnimationFrame(() => initSeekerBoard());
    }
  };

  /* Handle payment return */
  sbHandlePaymentReturn();

  /* Handle deep link */
  sbHandleDeepLink();

  /* Close post modal on backdrop click */
  const backdrop = document.getElementById('sb-post-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) sbClosePostForm();
    });
  }

  /* Close on Escape key */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const b = document.getElementById('sb-post-backdrop');
      if (b && b.classList.contains('sb-open')) sbClosePostForm();
    }
  });
});
