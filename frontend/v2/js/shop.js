// Shop details: the footer, the hero's operating line, and the open/closed
// indicator. Every value here comes from GET /shop-info — nothing on the page
// may claim an hour, a time or an address the backend did not send.
const Shop = (() => {
  const DAY_KEYS = ['sun', 'mon_thu', 'mon_thu', 'mon_thu', 'mon_thu', 'fri_sat', 'fri_sat'];

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value != null) el.textContent = value;
  }

  // "11:00-22:00" -> { open: 660, close: 1320 } in minutes past midnight.
  // Anything that does not parse cleanly returns null, and the caller then
  // shows nothing rather than guessing.
  function parseRange(text) {
    if (typeof text !== 'string') return null;
    const match = text.match(/^\s*(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})\s*$/);
    if (!match) return null;
    const [, h1, m1, h2, m2] = match.map(Number);
    const open = h1 * 60 + m1;
    const close = h2 * 60 + m2;
    if (close <= open) return null; // no overnight ranges in this data
    return { open, close };
  }

  function todayKey(now) {
    return DAY_KEYS[now.getDay()];
  }

  function hhmm(minutes) {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  function status(hours, now = new Date()) {
    if (!hours) return null;
    const range = parseRange(hours[todayKey(now)]);
    if (!range) return null;

    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes >= range.open && minutes < range.close) {
      return { open: true, text: `Open now · until ${hhmm(range.close)}` };
    }
    if (minutes < range.open) {
      return { open: false, text: `Closed · opens ${hhmm(range.open)}` };
    }
    return { open: false, text: 'Closed for today' };
  }

  function applyStatus(hours) {
    const state = status(hours);

    const heroItem = document.getElementById('hero-open');
    const heroSep = document.getElementById('hero-open-sep');
    const heroText = document.getElementById('hero-open-text');
    const footerItem = document.getElementById('footer-status');
    const footerText = document.getElementById('footer-status-text');

    if (!state) {
      // Unparseable or unreachable hours: say nothing rather than assert a
      // state we have not actually worked out.
      if (heroItem) heroItem.hidden = true;
      if (heroSep) heroSep.hidden = true;
      if (footerItem) footerItem.hidden = true;
      return;
    }

    if (heroItem && heroText) {
      heroItem.hidden = false;
      if (heroSep) heroSep.hidden = false;
      heroText.textContent = state.text;
      heroItem.querySelector('.dot')?.classList.toggle('dot-closed', !state.open);
    }
    if (footerItem && footerText) {
      footerItem.hidden = false;
      footerText.textContent = state.text;
      footerItem.querySelector('.dot')?.classList.toggle('dot-closed', !state.open);
    }

    // Mark the row the visitor is actually in, so scanning the list is quick.
    const key = todayKey(new Date());
    document.querySelectorAll('.hours-row').forEach((row) => {
      row.classList.toggle('is-today', row.dataset.day === key);
    });
  }

  function apply(shop) {
    if (!shop || !shop.name) return;

    setText('footer-shop-name', shop.name);
    setText('hero-delivery', formatRange(shop.delivery));
    setText('hero-pickup', formatRange(shop.pickup));
    setText('footer-delivery', formatRange(shop.delivery));
    setText('footer-pickup', formatRange(shop.pickup));

    const hours = shop.opening_hours || {};
    setText('hours-mon-thu', formatRange(hours.mon_thu));
    setText('hours-fri-sat', formatRange(hours.fri_sat));
    setText('hours-sun', formatRange(hours.sun));

    const addressLink = document.getElementById('footer-address-link');
    if (addressLink && shop.address) {
      addressLink.href = `https://maps.google.com/?q=${encodeURIComponent(shop.address)}`;
      setText('footer-address', shop.address);
    }

    const phoneLink = document.getElementById('footer-phone-link');
    if (phoneLink && shop.phone) {
      phoneLink.href = `tel:${shop.phone.replace(/[^\d+]/g, '')}`;
      setText('footer-phone', shop.phone);
    }

    const emailLink = document.getElementById('footer-email-link');
    if (emailLink && shop.email) {
      emailLink.href = `mailto:${shop.email}`;
      setText('footer-email', shop.email);
    }

    applyStatus(hours);
  }

  async function init() {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/shop-info`);
      if (res.ok) apply(await res.json());
    } catch (e) {
      /* keep the fallback content already written into the HTML */
    }
  }

  return { init, status, parseRange };
})();
