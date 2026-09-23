// Overlay machinery shared by the cart drawer, the customise sheet and the
// assistant.
//
// The original version's overlays were plain `hidden` toggles: no dialog role,
// no focus trap, no Escape, no focus restore, and the page behind them stayed
// scrollable. Everything that opens in Version B goes through here instead, so
// keyboard and screen-reader behaviour is uniform and correct by construction.
const Overlay = (() => {
  const stack = [];

  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function msVar(name) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return 200;
    return raw.endsWith('ms') ? value : value * 1000;
  }

  function focusableIn(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }

  function lockScroll() {
    if (document.body.dataset.scrollLocked === '1') return;
    // Compensate for the scrollbar so locking does not shift the layout.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.dataset.scrollLocked = '1';
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  }

  function releaseScroll() {
    if (stack.some((entry) => entry.modal)) return;
    delete document.body.dataset.scrollLocked;
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  function topEntry() {
    return stack[stack.length - 1] || null;
  }

  function onKeydown(event) {
    const entry = topEntry();
    if (!entry) return;

    if (event.key === 'Escape') {
      event.stopPropagation();
      close(entry.id);
      return;
    }

    if (event.key !== 'Tab' || !entry.modal) return;

    const focusables = focusableIn(entry.panel);
    if (!focusables.length) {
      event.preventDefault();
      entry.panel.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !entry.panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', onKeydown, true);

  /**
   * @param {object} config
   * @param {string} config.id            unique key for this overlay
   * @param {HTMLElement} config.layer    the element toggled with `hidden`
   * @param {HTMLElement} config.panel    the element focus is trapped inside
   * @param {boolean} [config.modal]      trap focus and lock scroll (default true)
   * @param {HTMLElement|string} [config.initialFocus]
   * @param {Function} [config.onClose]
   */
  function open(config) {
    if (stack.some((entry) => entry.id === config.id)) return;

    const entry = {
      modal: config.modal !== false,
      returnTo: document.activeElement,
      ...config,
    };

    entry.layer.hidden = false;
    entry.layer.classList.remove('is-leaving');
    if (entry.modal) lockScroll();
    stack.push(entry);

    // Let the entrance animation start before moving focus, otherwise the
    // browser scrolls to the element mid-transform.
    requestAnimationFrame(() => {
      const target =
        typeof entry.initialFocus === 'string'
          ? entry.panel.querySelector(entry.initialFocus)
          : entry.initialFocus;
      const fallback = focusableIn(entry.panel)[0];
      (target || fallback || entry.panel).focus({ preventScroll: true });
    });
  }

  function close(id, options = {}) {
    const index = stack.findIndex((entry) => entry.id === id);
    if (index === -1) return;

    const [entry] = stack.splice(index, 1);
    const finish = () => {
      entry.layer.hidden = true;
      entry.layer.classList.remove('is-leaving');
      entry.onClose?.();
      releaseScroll();
      // Skip focus restoration when the caller is handing focus somewhere
      // specific next — the cart → assistant handoff does exactly that.
      if (!options.keepFocus && entry.returnTo?.isConnected) {
        entry.returnTo.focus({ preventScroll: true });
      }
    };

    // Play the exit, then hide. The timeout is the guarantee: if the animation
    // is skipped (reduced motion, background tab), the overlay still closes.
    entry.layer.classList.add('is-leaving');
    setTimeout(finish, msVar('--t-routine') + 20);
  }

  function isOpen(id) {
    return stack.some((entry) => entry.id === id);
  }

  return { open, close, isOpen };
})();
