const Footer = (() => {
  function apply(shop) {
    document.getElementById('footer-shop-name').textContent = shop.name;
    document.getElementById('footer-shop-name-2').textContent = shop.name;
    document.getElementById('footer-delivery').textContent = shop.delivery;
    document.getElementById('footer-pickup').textContent = shop.pickup;

    document.getElementById('hours-mon-thu').textContent = shop.opening_hours.mon_thu;
    document.getElementById('hours-fri-sat').textContent = shop.opening_hours.fri_sat;
    document.getElementById('hours-sun').textContent = shop.opening_hours.sun;

    const addressLink = document.getElementById('footer-address-link');
    addressLink.href = `https://maps.google.com/?q=${encodeURIComponent(shop.address)}`;
    document.getElementById('footer-address').textContent = shop.address;

    document.getElementById('footer-phone-link').href = `tel:${shop.phone}`;
    document.getElementById('footer-phone').textContent = shop.phone;

    document.getElementById('footer-email-link').href = `mailto:${shop.email}`;
    document.getElementById('footer-email').textContent = shop.email;
  }

  async function init() {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/shop-info`);
      if (res.ok) {
        const shop = await res.json();
        apply(shop);
      }
    } catch (e) {
      /* keep the HTML fallback already in the page */
    }
  }

  return { init };
})();
