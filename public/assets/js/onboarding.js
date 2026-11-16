/* First-visit guide for the public NAVAREA portal. No framework or dependencies. */
(function () {
  'use strict';

  var STORAGE_KEY = 'hw-navarea-onboarding-v1';
  var steps = [
    {
      eyebrow: 'WELCOME',
      title: 'What is Helm.Warning?',
      body: 'Helm.Warning puts navigational warnings from different official sources on one map. It helps you see warnings around the world when planning or checking a voyage.',
      note: 'You can use the map without signing in. Always use official warnings and onboard information for navigation.'
    },
    {
      eyebrow: 'THE MAP',
      title: 'How do I read the map?',
      body: 'Each mark shows a warning location. A warning may appear as a point, a line or a shaded area. Tap or click a mark to see more information.',
      note: 'The map position may not be exact. Read the warning text and check the position before using it.'
    },
    {
      eyebrow: 'FIND WARNINGS',
      title: 'How do I find my area?',
      body: 'Choose a NAVAREA to see warnings for that region, or select the global view to see the wider picture. Use the Map and Data Bank views to browse warnings.',
      note: 'You can also use the available filters to narrow the warnings shown on the screen.'
    },
    {
      eyebrow: 'CHECK BEFORE USE',
      title: 'What should I check?',
      body: 'Open a warning and check its number, message, location, dates and status. Make sure it is still in force and read the original message.',
      note: 'This website is a helper, not an official navigation source. Always confirm important information with current official broadcasts, publications and your onboard systems.'
    }
  ];

  function init() {
    var modal = document.getElementById('navareaOnboarding');
    if (!modal) return;

    var title = modal.querySelector('#navareaOnboardingTitle');
    var eyebrow = modal.querySelector('#navareaOnboardingEyebrow');
    var body = modal.querySelector('#navareaOnboardingBody');
    var note = modal.querySelector('#navareaOnboardingNote');
    var count = modal.querySelector('#navareaOnboardingCount');
    var progress = modal.querySelector('#navareaOnboardingProgress');
    var back = modal.querySelector('[data-onboarding-back]');
    var next = modal.querySelector('[data-onboarding-next]');
    var skip = modal.querySelector('[data-onboarding-skip]');
    var close = modal.querySelector('[data-onboarding-close]');
    var dots = Array.prototype.slice.call(modal.querySelectorAll('[data-onboarding-step]'));
    var current = 0;
    var returnFocus = null;
    var previousOverflow = '';
    var isOpen = false;

    function hasCompleted() {
      try { return window.localStorage.getItem(STORAGE_KEY) === 'complete'; }
      catch (err) { return false; }
    }

    function markCompleted() {
      try { window.localStorage.setItem(STORAGE_KEY, 'complete'); }
      catch (err) { /* Storage may be unavailable; the guide remains usable this visit. */ }
    }

    function render() {
      var step = steps[current];
      eyebrow.textContent = step.eyebrow;
      title.textContent = step.title;
      body.textContent = step.body;
      note.textContent = step.note;
      count.textContent = (current + 1) + ' of ' + steps.length;
      progress.style.width = (((current + 1) / steps.length) * 100) + '%';
      var progressTrack = progress.parentNode;
      if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(current + 1));
      back.disabled = current === 0;
      next.textContent = current === steps.length - 1 ? 'Finish' : 'Next';
      dots.forEach(function (dot, index) {
        dot.setAttribute('aria-current', index === current ? 'step' : 'false');
      });
    }

    function focusables() {
      return Array.prototype.slice.call(modal.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
        .filter(function (el) { return !el.hidden && el.getAttribute('aria-hidden') !== 'true'; });
    }

    function open() {
      if (isOpen) return;
      returnFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      current = 0;
      render();
      modal.hidden = false;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      isOpen = true;
      close.focus();
    }

    function closeGuide(completed) {
      if (!isOpen) return;
      if (completed) markCompleted();
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      modal.hidden = true;
      document.body.style.overflow = previousOverflow;
      isOpen = false;
      if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    }

    function advance() {
      if (current < steps.length - 1) {
        current += 1;
        render();
        title.focus();
      } else {
        closeGuide(true);
      }
    }

    function retreat() {
      if (current > 0) {
        current -= 1;
        render();
        next.focus();
      }
    }

    next.addEventListener('click', advance);
    back.addEventListener('click', retreat);
    skip.addEventListener('click', function () { closeGuide(true); });
    close.addEventListener('click', function () { closeGuide(false); });
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var index = Number(dot.getAttribute('data-onboarding-step'));
        if (!Number.isInteger(index) || index < 0 || index >= steps.length) return;
        current = index;
        render();
        next.focus();
      });
    });

    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeGuide(false);
    });

    document.addEventListener('keydown', function (event) {
      if (!isOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeGuide(false);
        return;
      }
      if (event.key === 'Tab') {
        var items = focusables();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
      if (event.key === 'ArrowRight' && !event.altKey && !event.ctrlKey && !event.metaKey) advance();
      if (event.key === 'ArrowLeft' && !event.altKey && !event.ctrlKey && !event.metaKey) retreat();
    });

    var quickGuide = document.getElementById('openNavareaGuide');
    if (quickGuide) quickGuide.addEventListener('click', function () {
      if (typeof window.toggleMoreMenu === 'function') window.toggleMoreMenu(false);
      open();
    });

    if (!hasCompleted()) open();
  }

  function scheduleInit() {
    // Keep the first-visit guide, but let the map/data startup reach an idle
    // opportunity first so the modal setup does not compete with first paint.
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(init, { timeout: 1200 });
    } else {
      window.setTimeout(init, 250);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInit);
  else scheduleInit();
})();
