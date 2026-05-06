/* ============================================================
   GAMHUB ESTATE — WHATSAPP "UNLOCK BY SHARING" FEATURE
   unlock-share-feature.js

   Equivalent of unlock-share-feature.js from GamHub Jobs.
   Adapted for the property marketplace:
     - Share gate unlocks free property listings (not CV downloads)
     - Share gate unlocks free seeker profile posts
     - No PDF download logic (properties don't have PDFs)
     - Paid listings bypass the gate and go straight to ModemPay
     - All GMD pricing and WhatsApp message copy updated for estate

   Flow:
     1. Agent fills in property form, taps submit
     2. submitPropertyPost() detects free plan → calls showUnlockModal('property', cb)
     3. Modal shows progress (5 WhatsApp shares required)
     4. Each share tap opens WhatsApp with pre-written message & increments count
     5. On 5th share → unlock triggered → callback runs → savePropertyDirectly()
     6. On paid plan → skip gate entirely → ModemPay redirect

   Also patches:
     - submitPropertyPost() free path to run through the share gate
     - sbSubmitSeeker() free path to run through the share gate
   ============================================================ */

/* ============================================================
   SHARE UNLOCK — CONSTANTS & STATE
   ============================================================ */
const SHARE_UNLOCK_KEY  = 'ghe_share_unlock_count';
const SHARE_UNLOCK_GOAL = 5;

/** Pre-written WhatsApp message that agents / seekers send */
const GHE_SHARE_MESSAGE =
  '🇬🇲 *GamHub Estate* — Gambia\'s Property Marketplace!\n\n' +
  '🏡 Buy, Sell & Rent properties across The Gambia\n' +
  '📍 Verified listings in Banjul, Fajara, Kololi & more\n' +
  '🏢 Agents list properties for FREE\n' +
  '🔍 Buyers post requirements — agents find them instantly\n\n' +
  'Completely free to browse 👇\n' +
  'https://gamhubestate.gm';

/* ── Share count helpers ── */
function getShareCount() {
  return parseInt(localStorage.getItem(SHARE_UNLOCK_KEY) || '0', 10);
}
function incrementShareCount() {
  const next = getShareCount() + 1;
  localStorage.setItem(SHARE_UNLOCK_KEY, String(next));
  return next;
}

/* ── Session-level unlock token ──
   Prevents the gate re-firing within the same page session
   after the user has already completed their 5 shares.       */
const UNLOCK_USED_KEY = 'ghe_share_unlock_used';

function consumeShareUnlock() {
  const count = getShareCount();
  if (count > 0 && count % SHARE_UNLOCK_GOAL === 0) {
    localStorage.setItem(SHARE_UNLOCK_KEY, '0');
    sessionStorage.setItem(UNLOCK_USED_KEY, '1');
    return true;
  }
  return false;
}
function isShareUnlockPending() {
  return sessionStorage.getItem(UNLOCK_USED_KEY) === '1';
}
function clearSessionUnlock() {
  sessionStorage.removeItem(UNLOCK_USED_KEY);
}

/* ============================================================
   SHOW UNLOCK MODAL
   type: 'property' | 'seeker'
   onUnlock: callback fired once the user has shared 5 times
   ============================================================ */
function showUnlockModal(type, onUnlock) {
  /* Already unlocked in this session → run callback immediately */
  if (isShareUnlockPending()) {
    clearSessionUnlock();
    if (typeof onUnlock === 'function') onUnlock();
    return;
  }

  /* Share count just hit the goal → consume and unlock */
  if (consumeShareUnlock()) {
    if (typeof onUnlock === 'function') onUnlock();
    return;
  }

  /* Remove any previous modal */
  document.getElementById('ghe-unlock-overlay')?.remove();

  /* Config per type */
  const typeConfig = {
    property: {
      icon:          '🏡',
      title:         'List Your Property Free',
      subtitle:      'Share GamHub Estate with 5 contacts on WhatsApp to publish your free property listing.',
      benefit:       'Free Property Listing — Live within 24hrs',
      benefitSub:    'Unlocks after 5 WhatsApp shares',
      proceedLabel:  'Submit My Listing →',
    },
    seeker: {
      icon:          '🔍',
      title:         'Post Your Requirements Free',
      subtitle:      'Share GamHub Estate with 5 contacts on WhatsApp to post your property requirements.',
      benefit:       'Free Seeker Profile — Visible to agents',
      benefitSub:    'Unlocks after 5 WhatsApp shares',
      proceedLabel:  'Post My Requirements →',
    },
  };

  const cfg          = typeConfig[type] || typeConfig.property;
  const currentCount = getShareCount();

  /* ── Build overlay DOM ── */
  const overlay = document.createElement('div');
  overlay.id    = 'ghe-unlock-overlay';

  overlay.innerHTML = `
    <div class="ghe-unlock-backdrop" id="ghe-unlock-backdrop"></div>
    <div class="ghe-unlock-modal" id="ghe-unlock-modal"
         role="dialog" aria-modal="true" aria-labelledby="ghe-unlock-title">

      <button class="ghe-unlock-close" id="ghe-unlock-close" aria-label="Close">✕</button>

      <div class="ghe-unlock-icon-wrap">
        <div class="ghe-unlock-icon">${cfg.icon}</div>
        <div class="ghe-unlock-icon-ring"></div>
      </div>

      <h2 class="ghe-unlock-title" id="ghe-unlock-title">${cfg.title}</h2>
      <p  class="ghe-unlock-sub">${cfg.subtitle}</p>

      <div class="ghe-unlock-benefit">
        <span class="ghe-unlock-benefit-label">🎁 ${cfg.benefit}</span>
        <span class="ghe-unlock-benefit-sub">${cfg.benefitSub}</span>
      </div>

      <div class="ghe-unlock-progress-wrap">
        <div class="ghe-unlock-progress-header">
          <span class="ghe-unlock-progress-label">Share Progress</span>
          <span class="ghe-unlock-progress-count" id="ghe-unlock-count">
            ${currentCount} / ${SHARE_UNLOCK_GOAL} shares
          </span>
        </div>
        <div class="ghe-unlock-track"
             role="progressbar"
             aria-valuemin="0"
             aria-valuemax="${SHARE_UNLOCK_GOAL}"
             aria-valuenow="${currentCount}"
             id="ghe-unlock-track">
          <div class="ghe-unlock-fill" id="ghe-unlock-fill"
               style="width:${(currentCount / SHARE_UNLOCK_GOAL) * 100}%"></div>
          ${Array.from({ length: SHARE_UNLOCK_GOAL }, (_, i) => `
            <div class="ghe-unlock-pip ${i < currentCount ? 'done' : ''}"
                 style="left:${((i + 1) / SHARE_UNLOCK_GOAL) * 100}%"></div>
          `).join('')}
        </div>
        <div class="ghe-unlock-steps">
          ${Array.from({ length: SHARE_UNLOCK_GOAL }, (_, i) => `
            <div class="ghe-unlock-step ${i < currentCount ? 'done' : ''}">
              ${i < currentCount ? '✓' : i + 1}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Share button -->
      <button class="ghe-unlock-share-btn" id="ghe-unlock-share-btn">
        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M16 2C8.28 2 2 8.28 2 16c0 2.46.66 4.77 1.8 6.77L2 30l7.43-1.75A13.93
            13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5a11.44 11.44 0
            1 1-5.83-1.6l-.42-.25-4.3 1.01 1.04-4.2-.28-.44A11.5 11.5 0 1 1 16
            27.5zm6.35-8.6c-.35-.17-2.06-1.02-2.38-1.13-.32-.12-.55-.17-.78.17-.23.35-.9
            1.13-1.1 1.36-.2.23-.4.26-.75.09-.35-.17-1.48-.55-2.82-1.74-1.04-.93-1.75-2.08
            -1.95-2.43-.2-.35-.02-.54.15-.71.16-.16.35-.4.52-.6.17-.2.23-.35.35-.58.12-.23
            .06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.67c-.23
            0-.6.09-.91.43-.32.35-1.2 1.17-1.2 2.85s1.23 3.3 1.4 3.53c.17.23 2.42 3.7
            5.86 5.19.82.35 1.46.56 1.96.72.82.26 1.57.22 2.16.13.66-.1 2.06-.84
            2.35-1.66.29-.81.29-1.51.2-1.66-.08-.14-.31-.23-.66-.4z"/>
        </svg>
        Share on WhatsApp
        <span class="ghe-unlock-share-hint" id="ghe-unlock-share-hint">
          ${SHARE_UNLOCK_GOAL - currentCount} more share${(SHARE_UNLOCK_GOAL - currentCount) === 1 ? '' : 's'} to unlock
        </span>
      </button>

      <!-- Unlock complete state (hidden until goal reached) -->
      <div class="ghe-unlock-complete" id="ghe-unlock-complete" style="display:none">
        <div class="ghe-unlock-complete-icon">🎉</div>
        <h3>Unlocked! Thank you.</h3>
        <p>Thank you for sharing GamHub Estate with The Gambia!</p>
        <button class="ghe-unlock-proceed-btn" id="ghe-unlock-proceed-btn">
          ✦ ${cfg.proceedLabel}
        </button>
      </div>

      <p class="ghe-unlock-note">
        Each tap opens WhatsApp with a ready-made message.
        Progress saves automatically — close and return any time.
      </p>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  /* Animate in */
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));

  /* ── Wire up events ── */
  document.getElementById('ghe-unlock-close')
    .addEventListener('click', () => closeUnlockModal());

  document.getElementById('ghe-unlock-backdrop')
    .addEventListener('click', () => closeUnlockModal());

  document.getElementById('ghe-unlock-share-btn')
    .addEventListener('click', () => _handleShare(type, onUnlock));
}

/* ============================================================
   HANDLE SHARE CLICK
   ============================================================ */
function _handleShare(type, onUnlock) {
  /* Open WhatsApp with the pre-written message */
  const encoded = encodeURIComponent(GHE_SHARE_MESSAGE);
  window.open('https://wa.me/?text=' + encoded, '_blank', 'noopener,noreferrer');

  const newCount = incrementShareCount();
  _updateUnlockUI(newCount);

  if (newCount >= SHARE_UNLOCK_GOAL) {
    /* Small delay so user sees the progress bar fill to 100% */
    setTimeout(() => _triggerUnlockSuccess(type, onUnlock), 550);
  } else {
    const remaining = SHARE_UNLOCK_GOAL - newCount;
    if (typeof toast === 'function') {
      toast(
        newCount + '/' + SHARE_UNLOCK_GOAL + ' shares done — ' +
        remaining + ' more to unlock ✦',
        'gold', 3000
      );
    }
  }
}

/* ============================================================
   UPDATE PROGRESS BAR UI
   ============================================================ */
function _updateUnlockUI(count) {
  const fill     = document.getElementById('ghe-unlock-fill');
  const countEl  = document.getElementById('ghe-unlock-count');
  const hintEl   = document.getElementById('ghe-unlock-share-hint');
  const track    = document.getElementById('ghe-unlock-track');
  const stepsEl  = document.querySelector('.ghe-unlock-steps');

  if (!fill) return;

  const pct = Math.min((count / SHARE_UNLOCK_GOAL) * 100, 100);
  fill.style.width = pct + '%';
  if (pct >= 100) fill.classList.add('complete');

  if (countEl) countEl.textContent = count + ' / ' + SHARE_UNLOCK_GOAL + ' shares';
  if (track)   track.setAttribute('aria-valuenow', String(count));

  if (hintEl) {
    const remaining = SHARE_UNLOCK_GOAL - count;
    hintEl.textContent = remaining > 0
      ? remaining + ' more share' + (remaining === 1 ? '' : 's') + ' to unlock'
      : '🔓 Unlocked!';
  }

  /* Pip markers */
  document.querySelectorAll('.ghe-unlock-pip').forEach((pip, i) => {
    pip.classList.toggle('done', i < count);
  });

  /* Step badge icons */
  if (stepsEl) {
    stepsEl.querySelectorAll('.ghe-unlock-step').forEach((step, i) => {
      if (i < count) { step.classList.add('done'); step.textContent = '✓'; }
    });
  }
}

/* ============================================================
   TRIGGER UNLOCK COMPLETE STATE
   ============================================================ */
function _triggerUnlockSuccess(type, onUnlock) {
  /* Track analytics */
  if (typeof trackShareUnlockCompleted === 'function') trackShareUnlockCompleted(type);

  /* Mark unlock consumed — sets session token, resets localStorage count */
  consumeShareUnlock();

  const shareBtn   = document.getElementById('ghe-unlock-share-btn');
  const completeEl = document.getElementById('ghe-unlock-complete');
  const modal      = document.getElementById('ghe-unlock-modal');
  const proceedBtn = document.getElementById('ghe-unlock-proceed-btn');

  if (shareBtn)   shareBtn.style.display   = 'none';
  if (completeEl) completeEl.style.display = '';
  if (modal)      modal.classList.add('unlocked');

  if (typeof toast === 'function') {
    toast('🎉 Unlocked! Thank you for sharing GamHub Estate!', 'success', 5000);
  }

  if (proceedBtn) {
    /* Clone to remove any stale listeners */
    const freshBtn = proceedBtn.cloneNode(true);
    proceedBtn.replaceWith(freshBtn);

    freshBtn.addEventListener('click', () => {
      closeUnlockModal();
      clearSessionUnlock();
      if (typeof onUnlock === 'function') onUnlock();
    });
  }
}

/* ============================================================
   CLOSE MODAL
   ============================================================ */
function closeUnlockModal() {
  const overlay = document.getElementById('ghe-unlock-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  document.body.style.overflow = '';
  setTimeout(() => overlay.remove(), 400);
}

/* ============================================================
   PATCH submitPropertyPost() — FREE PATH
   Wraps the free-plan submission in the share gate.
   This function re-declares submitPropertyPost so the last
   definition in script load order wins — place this file
   AFTER script.js in index.html.
   ============================================================ */
const _originalSubmitPropertyPost = window.submitPropertyPost;

window.submitPropertyPost = async function submitPropertyPost() {

  /* Collect & validate (same checks as script.js) */
  const title      = document.getElementById('pp-title')?.value.trim()       || '';
  const agentName  = document.getElementById('pp-agent-name')?.value.trim()  || '';
  const email      = document.getElementById('pp-email')?.value.trim()       || '';
  const phone      = document.getElementById('pp-phone')?.value.trim()       || '';
  const location   = document.getElementById('pp-location')?.value           || '';
  const listType   = document.getElementById('pp-listing-type')?.value       || '';
  const description= document.getElementById('pp-description')?.value.trim() || '';

  if (!title)                         { toast('Please enter a property title', 'error');                         return; }
  if (!agentName)                     { toast('Please enter your name or agency name', 'error');                 return; }
  if (!email || !email.includes('@')) { toast('Please enter a valid contact email', 'error');                    return; }
  if (!phone)                         { toast('Please enter a WhatsApp / phone number', 'error');                return; }
  if (!location)                      { toast('Please select a location', 'error');                             return; }
  if (!listType)                      { toast('Please select the listing type (Sale / Rent / etc.)', 'error');   return; }
  if (description.length < 100)       { toast('Description must be at least 100 characters', 'error');          return; }

  const plan   = typeof getSelectedPlan === 'function' ? getSelectedPlan() : 'free';
  const amount = (typeof MODEMPAY_CONFIG !== 'undefined' && MODEMPAY_CONFIG.PRICES)
    ? (MODEMPAY_CONFIG.PRICES[plan] || 0) : 0;

  /* ── Paid plan → skip gate, go straight to ModemPay ── */
  if (amount > 0) {
    if (typeof _originalSubmitPropertyPost === 'function') {
      _originalSubmitPropertyPost();
    }
    return;
  }

  /* ── Free plan → rate limit check ── */
  if (typeof freeListingCountRemaining === 'function') {
    const remaining = freeListingCountRemaining('property');
    if (remaining <= 0) {
      if (typeof freeListingShowLimitMessage === 'function') freeListingShowLimitMessage('property');
      return;
    }
    if (remaining === 1) {
      toast('Heads up — this is your last free listing for the next 7 days.', 'gold', 5000);
    }
  }

  /* ── Free plan → share gate ── */
  showUnlockModal('property', async () => {
    /* After unlock — build and save payload */
    const photosRaw = (document.getElementById('pp-photos')?.value || '')
      .split('\n').map(u => u.trim()).filter(u => /^https?:\/\//i.test(u));

    const rawPayload = {
      title,
      agent_name:   agentName,
      company:      document.getElementById('pp-company')?.value.trim()    || '',
      email,
      phone,
      website:      document.getElementById('pp-website')?.value.trim()    || '',
      logo_url:     document.getElementById('pp-logo-url')?.value.trim()   || '',
      listing_type: listType,
      category:     document.getElementById('pp-category')?.value          || '',
      location,
      street:       document.getElementById('pp-street')?.value.trim()     || '',
      price:        document.getElementById('pp-price')?.value.trim()      || '',
      price_type:   document.getElementById('pp-price-type')?.value        || 'fixed',
      bedrooms:     document.getElementById('pp-bedrooms')?.value          || '',
      bathrooms:    document.getElementById('pp-bathrooms')?.value         || '',
      size:         document.getElementById('pp-size')?.value.trim()       || '',
      available:    document.getElementById('pp-available')?.value         || '',
      description,
      amenities:    typeof getSelectedAmenities === 'function' ? getSelectedAmenities() : [],
      photos:       photosRaw,
      map_link:     document.getElementById('pp-map-link')?.value.trim()   || '',
      plan,
      approved:     false,
      submitted_at: new Date().toISOString(),
    };

    const payload = typeof sanitizePropertyPayload === 'function'
      ? sanitizePropertyPayload(rawPayload)
      : rawPayload;

    payload.agent = agentName;

    if (typeof savePropertyDirectly === 'function') {
      await savePropertyDirectly(payload);
    }
  });
};

/* ============================================================
   PATCH sbSubmitSeeker() — FREE PATH
   Wraps the free-plan seeker submission in the share gate.
   ============================================================ */
const _originalSbSubmitSeeker = window.sbSubmitSeeker;

window.sbSubmitSeeker = function sbSubmitSeeker() {

  /* Collect & validate (mirrors seeker-board.js) */
  const name     = document.getElementById('sk-name')?.value.trim()         || '';
  const email    = document.getElementById('sk-email')?.value.trim()        || '';
  const listType = document.getElementById('sk-listing-type')?.value        || '';
  const location = document.getElementById('sk-location')?.value.trim()     || '';
  const budget   = document.getElementById('sk-budget')?.value.trim()       || '';
  const timeline = document.getElementById('sk-timeline')?.value            || 'Flexible';

  if (!name)                          { if (typeof sbToast === 'function') sbToast('Please enter your name', 'error');                   return; }
  if (!email || !email.includes('@')) { if (typeof sbToast === 'function') sbToast('Please enter a valid email address', 'error');        return; }
  if (!listType)                      { if (typeof sbToast === 'function') sbToast('Please select what you are looking for', 'error');    return; }
  if (!location)                      { if (typeof sbToast === 'function') sbToast('Please enter your preferred location(s)', 'error');   return; }
  if (!budget)                        { if (typeof sbToast === 'function') sbToast('Please enter your budget', 'error');                  return; }

  const plan   = typeof sbGetSelectedPlan === 'function' ? sbGetSelectedPlan() : 'free';
  const amount = (typeof SB_PLAN_PRICES !== 'undefined') ? (SB_PLAN_PRICES[plan] || 0) : 0;

  /* ── Paid plan → skip gate ── */
  if (amount > 0) {
    if (typeof _originalSbSubmitSeeker === 'function') {
      _originalSbSubmitSeeker();
    }
    return;
  }

  /* ── Free plan → rate limit check ── */
  if (typeof freeListingCountRemaining === 'function') {
    const remaining = freeListingCountRemaining('seeker');
    if (remaining <= 0) {
      if (typeof freeListingShowLimitMessage === 'function') freeListingShowLimitMessage('seeker');
      return;
    }
    if (remaining === 1) {
      if (typeof toast === 'function') toast('Heads up — this is your last free seeker profile for the next 7 days.', 'gold', 5000);
    }
  }

  /* ── Free plan → share gate ── */
  showUnlockModal('seeker', () => {
    /* After unlock — build payload and save */
    const token = 'sk-' + name.toLowerCase().replace(/\s+/g, '-').slice(0, 12) + '-' + Math.floor(Date.now() / 1000);

    const sbSanitizeFn = typeof sbSanitize      === 'function' ? sbSanitize      : (v, m) => String(v || '').trim().slice(0, m || 500);
    const sbEmailFn    = typeof sbSanitizeEmail === 'function' ? sbSanitizeEmail : v => String(v || '').trim();

    const payload = {
      id:           token,
      name:         sbSanitizeFn(name, 100),
      email:        sbEmailFn(email) || '',
      phone:        sbSanitizeFn(document.getElementById('sk-phone')?.value.trim() || '', 40),
      listing_type: sbSanitizeFn(listType, 40),
      category:     sbSanitizeFn(document.getElementById('sk-category')?.value     || '', 60),
      location_pref:sbSanitizeFn(location, 200),
      bedrooms:     sbSanitizeFn(document.getElementById('sk-bedrooms')?.value     || '', 20),
      budget:       sbSanitizeFn(budget, 100),
      timeline:     sbSanitizeFn(timeline, 40),
      requirements: sbSanitizeFn(document.getElementById('sk-requirements')?.value.trim() || '', 1000),
      plan,
      featured:     false,
      approved:     true,
      submitted_at: new Date().toISOString(),
    };

    if (typeof sbFinaliseProfileSubmit === 'function') {
      sbFinaliseProfileSubmit(payload);
    }
  });
};

/* ============================================================
   STUB out saveJobDirectly / savePropertyDirectly
   so the original script.js free path is never called directly;
   all free-plan submissions now run through the share gate above.
   ============================================================ */
if (typeof window.saveJobDirectly !== 'undefined') {
  window.saveJobDirectly = async function() {
    console.log('[GHE] saveJobDirectly() suppressed — share gate is active');
  };
}
