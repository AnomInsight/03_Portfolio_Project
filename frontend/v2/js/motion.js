// Motion helpers.
//
// Two rules hold everywhere in here:
//   1. Content is visible by default. Nothing is hidden until the script has
//      confirmed it can un-hide it, so a failed load never blanks the page.
//   2. prefers-reduced-motion is read at call time, not cached at startup,
//      because the user can change it while the page is open.
const Motion = (() => {
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reducedQuery.matches;

  // --- Reveal on scroll ---------------------------------------------------
  // One entrance, used once, on a small number of blocks. Sibling stagger is
  // capped so a long list never turns into a wait.
  function initReveals() {
    // Skip anything a previous call already armed, so re-rendering the menu
    // does not stack observers on the elements that were already handled.
    const targets = [...document.querySelectorAll('.reveal:not(.is-armed)')];
    if (!targets.length || !('IntersectionObserver' in window)) return;

    // Arming is what actually hides them, so this only happens once we know
    // the observer exists to bring them back.
    targets.forEach((el) => el.classList.add('is-armed'));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    targets.forEach((el) => io.observe(el));
  }

  // Applies a capped stagger to a freshly rendered group of siblings.
  function stagger(elements, step = 40, cap = 240) {
    elements.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${Math.min(i * step, cap)}ms`);
    });
  }

  // --- Add-to-cart trace --------------------------------------------------
  // The result of adding something should be visible, not only counted. A
  // thumbnail flies from the sheet to the cart trigger; under reduced motion
  // the stamp and the count still happen, the flight does not.
  function flyToCart(sourceEl, imageSrc) {
    const target = document.getElementById('cart-trigger');
    if (!target) return;

    const stamp = () => {
      target.classList.remove('is-stamped');
      // Force a reflow so the animation restarts on a rapid second add.
      void target.offsetWidth;
      target.classList.add('is-stamped');
      target.addEventListener('animationend', () => target.classList.remove('is-stamped'), { once: true });
    };

    if (reduced() || !sourceEl || !imageSrc || typeof sourceEl.animate !== 'function') {
      stamp();
      return;
    }

    const from = sourceEl.getBoundingClientRect();
    const to = target.getBoundingClientRect();

    const flier = document.createElement('div');
    flier.className = 'flight';
    flier.innerHTML = `<img src="${imageSrc}" alt="" />`;
    flier.style.left = `${from.left + from.width / 2 - 24}px`;
    flier.style.top = `${from.top + from.height / 2 - 24}px`;
    document.body.appendChild(flier);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    const animation = flier.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.42 - 40}px) scale(0.8)`, opacity: 0.95, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.28)`, opacity: 0 },
      ],
      { duration: 520, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' },
    );

    animation.onfinish = () => {
      flier.remove();
      stamp();
    };
    // If the tab is backgrounded mid-flight the animation may never finish.
    setTimeout(() => flier.remove(), 1200);
  }

  // --- Announcements ------------------------------------------------------
  function announce(message) {
    const region = document.getElementById('live-region');
    if (!region) return;
    region.textContent = '';
    // A fresh text node in the next frame is what makes screen readers speak
    // a repeated message twice.
    requestAnimationFrame(() => {
      region.textContent = message;
    });
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }

  return { reduced, initReveals, stagger, flyToCart, announce, scrollToSection };
})();
