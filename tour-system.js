/* ============================================================
   GAMHUB ESTATE — TOUR / HINT SYSTEM
   tour-system.js

   Equivalent of tour-system.js from GamHub Jobs.
   Scroll-triggered contextual hints guide first-time visitors
   through the property marketplace.

   Architecture:
     - TOURS array defines every hint (view, target, text, trigger)
     - GHETour object exposes: init, triggerView, dismiss, dismissAll, reset
     - Scroll-triggered hints use IntersectionObserver — zero timers
     - Timer-triggered hints used only for always-visible navbar elements
     - Popovers auto-reposition on resize and scroll

   Naming convention:
     GHETour → public API (was GHJTour in GamHub Jobs)
     ghe-    → CSS class prefix
   ============================================================ */

const GHETour = (() => {

  /* ============================================================
     STORAGE
     ============================================================ */
  const STORAGE_KEY = 'ghe_tour_v1';

  /* ============================================================
     TOUR DEFINITIONS
     Each entry maps one hint to one view + one DOM element.

     trigger: 'scroll' → fires when target enters the viewport
              'timer'  → fires after `delay` ms (always-visible els)

     noOverlay: true   → skip the dim overlay (less intrusive)
     theme: 'dark'     → use the dark popover variant (hero hints)
     ringClass: ''     → extra class on the ring (circle/pill/soft)
     scrollDelay: N    → ms to wait after scroll trigger (default 300)
   ============================================================ */
  const TOURS = [

    /* ── Landing page — navbar (timer, always visible) ── */
    {
      id: 'landing-hamburger',
      targetId: 'hamburger',
      text: 'Tap here to <em>log in</em> and access the full menu',
      side: 'left',
      view: 'landing',
      trigger: 'timer',
      delay: 1800,
      group: 'landing-nav',
      groupIndex: 1,
      groupTotal: 1,
    },

    /* ── Landing page — hero search bar (scroll) ── */
    {
      id: 'landing-hero-search',
      targetId: 'hero-search-bar',
      text: 'Search by type, location and bedrooms to <em>find your match</em> instantly',
      side: 'bottom',
      view: 'landing',
      trigger: 'scroll',
      threshold: 0.6,
      noOverlay: true,
      theme: 'dark',
      ringClass: 'ring-soft',
      group: 'landing-hero',
      groupIndex: 1,
      groupTotal: 2,
    },
    {
      id: 'landing-hero-stats',
      targetId: 'hero-search-bar',
      text: 'Or browse by <em>property type</em> below — click any card to start',
      side: 'bottom',
      view: 'landing',
      trigger: 'scroll',
      threshold: 0.4,
      noOverlay: true,
      theme: 'dark',
      scrollDelay: 900,
      group: 'landing-hero',
      groupIndex: 2,
      groupTotal: 2,
    },

    /* ── Landing page — features section (scroll) ── */
    {
      id: 'landing-features',
      targetId: 'features',
      text: 'Agents — listing a property here is <em>completely free</em>',
      side: 'top',
      view: 'landing',
      trigger: 'scroll',
      threshold: 0.2,
      noOverlay: true,
      group: 'landing-sections',
      groupIndex: 1,
      groupTotal: 2,
    },
    {
      id: 'landing-locations',
      targetId: 'locations',
      text: 'Tap any location chip to <em>instantly filter</em> properties in that area',
      side: 'top',
      view: 'landing',
      trigger: 'scroll',
      threshold: 0.25,
      noOverlay: true,
      group: 'landing-sections',
      groupIndex: 2,
      groupTotal: 2,
    },

    /* ── Property Search view ── */
    {
      id: 'search-filters',
      targetId: 'ps-keyword',
      text: 'Search by <em>title, location or agent</em> — or use the dropdowns to filter by type and bedrooms',
      side: 'bottom',
      view: 'search',
      trigger: 'scroll',
      threshold: 0.8,
      noOverlay: true,
      group: 'search',
      groupIndex: 1,
      groupTotal: 2,
    },
    {
      id: 'search-first-card',
      targetId: 'ghe-first-contact-btn',
      text: 'Tap <em>Contact →</em> to email the agent directly — no middleman, no fees',
      side: 'top',
      view: 'search',
      trigger: 'scroll',
      threshold: 0.4,
      noOverlay: true,
      group: 'search',
      groupIndex: 2,
      groupTotal: 2,
    },

    /* ── Agent Portal ── */
    {
      id: 'agent-form-photos',
      targetId: 'pp-photos',
      text: 'Upload photos to <em>imgbb.com</em> free, then paste the links here — listings with 3+ photos get 4× more enquiries',
      side: 'top',
      view: 'agent-portal',
      trigger: 'scroll',
      threshold: 0.5,
      noOverlay: true,
      group: 'agent',
      groupIndex: 1,
      groupTotal: 3,
    },
    {
      id: 'agent-form-amenities',
      targetId: 'amenities-grid',
      text: 'Select every amenity that applies — <em>generator, borehole and pool</em> are the top three buyer priorities',
      side: 'top',
      view: 'agent-portal',
      trigger: 'scroll',
      threshold: 0.4,
      noOverlay: true,
      group: 'agent',
      groupIndex: 2,
      groupTotal: 3,
    },
    {
      id: 'agent-submit-btn',
      targetId: 'submit-property-btn',
      text: 'Free listings go live within <em>24 hours</em> — Featured gets priority placement and a buyer blast',
      side: 'top',
      view: 'agent-portal',
      trigger: 'scroll',
      threshold: 0.6,
      noOverlay: true,
      group: 'agent',
      groupIndex: 3,
      groupTotal: 3,
    },

    /* ── Seeker Board ── */
    {
      id: 'seeker-post-btn',
      targetId: 'sb-post-btn',
      text: 'Buyers — tap <em>Post My Requirements</em> to let agents and sellers find you for free',
      side: 'bottom',
      view: 'seeker-board',
      trigger: 'timer',
      delay: 1000,
      group: 'seeker',
      groupIndex: 1,
      groupTotal: 2,
    },
    {
      id: 'seeker-search',
      targetId: 'sb-keyword',
      text: 'Agents — search by <em>location, budget or property type</em> to find ready buyers instantly',
      side: 'bottom',
      view: 'seeker-board',
      trigger: 'scroll',
      threshold: 0.8,
      noOverlay: true,
      group: 'seeker',
      groupIndex: 2,
      groupTotal: 2,
    },

    /* ── Property Detail full page ── */
    {
      id: 'detail-contact',
      targetId: 'pd-page-actions',
      text: 'Contact the agent by <em>email or WhatsApp</em> — or view the property on Google Maps',
      side: 'top',
      view: 'property-detail',
      trigger: 'scroll',
      threshold: 0.5,
      noOverlay: true,
      group: 'detail',
      groupIndex: 1,
      groupTotal: 1,
    },

  ];

  /* ============================================================
     STATE
     ============================================================ */
  let _dismissed      = {};
  let _activeTimers   = [];
  let _activePopovers = [];  /* [{ step, pop, ring }] */
  let _scrollObserver = null;
  let _pendingScroll  = [];  /* steps waiting for their target to scroll into view */
  let _currentView    = null;

  /* ============================================================
     PERSISTENCE
     ============================================================ */
  function _loadState() {
    try { _dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { _dismissed = {}; }
  }
  function _saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_dismissed)); }
    catch {}
  }
  function _isDismissed(id) { return !!_dismissed[id]; }
  function _markDismissed(id) { _dismissed[id] = true; _saveState(); }

  /* ============================================================
     DOM HELPERS
     ============================================================ */
  function _overlay() { return document.getElementById('tour-overlay'); }

  /**
   * Stamp IDs onto elements that are rendered dynamically
   * so tour steps can target them by ID.
   */
  function _stampDynamicIds() {
    /* First "Contact" button on the property grid */
    if (!document.getElementById('ghe-first-contact-btn')) {
      const btn = document.querySelector('#ps-property-grid .ps-btn-contact');
      if (btn) btn.id = 'ghe-first-contact-btn';
    }
  }

  /* ============================================================
     POSITIONING
     ============================================================ */

  /** Choose best side if 'auto' is requested */
  function _bestSide(tr, pw, ph) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (tr.top  > ph + 60)         return 'top';
    if (vh - tr.bottom > ph + 60)  return 'bottom';
    if (tr.left > pw + 60)         return 'left';
    return 'right';
  }

  /** Position a popover relative to its target element */
  function _positionPopover(el, targetEl, side) {
    const tr  = targetEl.getBoundingClientRect();
    const pw  = el.offsetWidth  || 230;
    const ph  = el.offsetHeight || 100;
    const GAP = 16;
    const M   = 12; /* min margin from viewport edge */
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;

    const s = (side === 'auto') ? _bestSide(tr, pw, ph) : side;
    let top, left, arrowDir;

    switch (s) {
      case 'top':
        top      = tr.top  - ph - GAP;
        left     = tr.left + tr.width  / 2 - pw / 2;
        arrowDir = 'bottom';
        break;
      case 'bottom':
        top      = tr.bottom + GAP;
        left     = tr.left + tr.width  / 2 - pw / 2;
        arrowDir = 'top';
        break;
      case 'left':
        top      = tr.top  + tr.height / 2 - ph / 2;
        left     = tr.left - pw - GAP;
        arrowDir = 'right';
        break;
      default: /* right */
        top      = tr.top  + tr.height / 2 - ph / 2;
        left     = tr.right + GAP;
        arrowDir = 'left';
    }

    /* Clamp to viewport */
    top  = Math.max(M, Math.min(top,  vh - ph - M));
    left = Math.max(M, Math.min(left, vw - pw - M));

    el.style.top  = top  + 'px';
    el.style.left = left + 'px';
    el.setAttribute('data-arrow', arrowDir);
  }

  /** Position the highlight ring around its target element */
  function _positionRing(ringEl, targetEl) {
    const tr  = targetEl.getBoundingClientRect();
    const PAD = 5;
    ringEl.style.top    = (tr.top    - PAD) + 'px';
    ringEl.style.left   = (tr.left   - PAD) + 'px';
    ringEl.style.width  = (tr.width  + PAD * 2) + 'px';
    ringEl.style.height = (tr.height + PAD * 2) + 'px';
  }

  /* ============================================================
     BUILD & SHOW ONE POPOVER
     ============================================================ */
  function _showStep(step) {
    if (_isDismissed(step.id))                        return;
    if (step.view !== '*' && step.view !== _currentView) return;

    _stampDynamicIds();
    const targetEl = document.getElementById(step.targetId);
    if (!targetEl)                                    return;
    if (document.getElementById('ghe-pop-' + step.id)) return;

    /* ── Ring ── */
    const ring = document.createElement('div');
    ring.className = 'ghe-tour-ring' + (step.ringClass ? ' ' + step.ringClass : '');
    ring.id = 'ghe-ring-' + step.id;
    document.body.appendChild(ring);

    /* ── Popover ── */
    const pop = document.createElement('div');
    pop.className = 'ghe-tour-popover' + (step.theme ? ' theme-' + step.theme : '');
    pop.id = 'ghe-pop-' + step.id;
    pop.setAttribute('role', 'tooltip');
    pop.setAttribute('aria-live', 'polite');

    /* Step progress dots */
    const pillHTML = step.groupTotal > 1
      ? `<div class="ghe-tour-step-pill">
           ${Array.from({ length: step.groupTotal }, (_, i) =>
             `<div class="ghe-tour-dot ${i + 1 === step.groupIndex ? 'active' : ''}"></div>`
           ).join('')}
           <span>${step.groupIndex} of ${step.groupTotal}</span>
         </div>`
      : '';

    /* Directional arrow SVG */
    const arrowSVG = `
      <svg class="ghe-tour-arrow" viewBox="0 0 28 28" fill="none"
           xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 14 L22 14 M22 14 L14 6 M22 14 L14 22"
              stroke="#bc643c" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round"
              opacity="0.7"/>
      </svg>`;

    pop.innerHTML = `
      <button class="ghe-tour-dismiss" aria-label="Dismiss hint"
        onclick="GHETour.dismiss('${step.id}')">✕</button>
      <div class="ghe-tour-text">${step.text}</div>
      ${pillHTML}
      ${arrowSVG}
    `;

    document.body.appendChild(pop);

    /* Position both elements */
    requestAnimationFrame(() => {
      _positionPopover(pop, targetEl, step.side || 'auto');
      _positionRing(ring, targetEl);

      requestAnimationFrame(() => {
        pop.classList.add('visible');
        ring.classList.add('visible');
      });
    });

    _activePopovers.push({ step, pop, ring });

    /* Dim overlay — only for the first step of a non-overlay group */
    if (!step.noOverlay && step.groupIndex === 1) {
      _overlay()?.classList.add('active');
    }
  }

  /* ============================================================
     SCROLL OBSERVER
     ============================================================ */
  function _buildObserver() {
    if (_scrollObserver) _scrollObserver.disconnect();

    _scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        /* Find all pending steps whose target is this element */
        const triggered = _pendingScroll.filter(
          s => document.getElementById(s.targetId) === entry.target
        );

        triggered.forEach(step => {
          _pendingScroll = _pendingScroll.filter(s => s.id !== step.id);
          _scrollObserver.unobserve(entry.target);

          const delay = step.scrollDelay || 300;
          const t = setTimeout(() => _showStep(step), delay);
          _activeTimers.push(t);
        });
      });
    }, {
      rootMargin: '0px 0px -10% 0px',
      threshold:  0,
    });
  }

  /** Register a step for scroll-based triggering */
  function _watchForScroll(step) {
    _stampDynamicIds();
    const targetEl = document.getElementById(step.targetId);

    if (!targetEl) {
      /* Retry a few times — the element may be rendered later */
      let tries = 0;
      const retry = setInterval(() => {
        tries++;
        _stampDynamicIds();
        const el = document.getElementById(step.targetId);
        if (el) {
          clearInterval(retry);
          _pendingScroll.push(step);
          _scrollObserver.observe(el);
        } else if (tries > 15) {
          clearInterval(retry);
        }
      }, 500);
      return;
    }

    /* If target already in viewport — show after short delay */
    const rect           = targetEl.getBoundingClientRect();
    const alreadyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;

    if (alreadyVisible) {
      const t = setTimeout(() => _showStep(step), step.scrollDelay || 600);
      _activeTimers.push(t);
    } else {
      _pendingScroll.push(step);
      _scrollObserver.observe(targetEl);
    }
  }

  /* ============================================================
     DISMISS
     ============================================================ */

  /** Dismiss a single hint by ID */
  function dismiss(id) {
    _markDismissed(id);

    const idx = _activePopovers.findIndex(p => p.step.id === id);
    if (idx === -1) return;

    const { pop, ring } = _activePopovers[idx];

    pop.classList.remove('visible');
    ring.classList.remove('visible');
    ring.classList.add('dismissing');

    setTimeout(() => { pop.remove(); ring.remove(); }, 320);
    _activePopovers.splice(idx, 1);

    /* Remove dim overlay when last popover closes */
    if (_activePopovers.length === 0) {
      _overlay()?.classList.remove('active');
    }
  }

  /** Dismiss all currently visible hints */
  function dismissAll() {
    [..._activePopovers].forEach(p => dismiss(p.step.id));
  }

  /* ============================================================
     TRIGGER VIEW
     Called by showView() every time the user navigates
     ============================================================ */
  function triggerView(viewId) {
    _currentView = viewId;

    /* Clear any pending timers and scroll watchers from the previous view */
    _activeTimers.forEach(t => clearTimeout(t));
    _activeTimers = [];

    if (_scrollObserver) _scrollObserver.disconnect();
    _pendingScroll = [];

    /* Close any leftover popovers from the previous view */
    dismissAll();

    /* Rebuild observer for the new view */
    _buildObserver();

    /* Collect and schedule steps for this view */
    const steps = TOURS.filter(s =>
      (s.view === viewId || s.view === '*') && !_isDismissed(s.id)
    );

    steps.forEach(step => {
      if (step.trigger === 'scroll') {
        _watchForScroll(step);
      } else {
        /* timer-based — used for navbar / always-visible elements */
        const t = setTimeout(() => _showStep(step), step.delay || 800);
        _activeTimers.push(t);
      }
    });
  }

  /* ============================================================
     REPOSITION ON RESIZE
     ============================================================ */
  window.addEventListener('resize', () => {
    _stampDynamicIds();
    _activePopovers.forEach(({ step, pop, ring }) => {
      const targetEl = document.getElementById(step.targetId);
      if (!targetEl) return;
      _positionPopover(pop, targetEl, step.side || 'auto');
      _positionRing(ring, targetEl);
    });
  }, { passive: true });

  /* ============================================================
     REPOSITION ON SCROLL
     Uses rAF throttling to keep it cheap
     ============================================================ */
  let _scrollRaf = null;
  window.addEventListener('scroll', () => {
    if (_activePopovers.length === 0) return;
    if (_scrollRaf) return;
    _scrollRaf = requestAnimationFrame(() => {
      _scrollRaf = null;
      _activePopovers.forEach(({ step, pop, ring }) => {
        const targetEl = document.getElementById(step.targetId);
        if (!targetEl) return;
        _positionPopover(pop, targetEl, step.side || 'auto');
        _positionRing(ring, targetEl);
      });
    });
  }, { passive: true });

  /* ============================================================
     RESET — wipes all dismissed state (dev / testing helper)
     Call GHETour.reset() in the browser console to restart hints
     ============================================================ */
  function reset() {
    _dismissed = {};
    _saveState();
    console.log('[GHETour] All hints reset — reload the page to see them again.');
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    _loadState();
    _buildObserver();
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  return { init, triggerView, dismiss, dismissAll, reset };

})();

/* ============================================================
   AUTO-INIT ON DOM READY
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => GHETour.init());
