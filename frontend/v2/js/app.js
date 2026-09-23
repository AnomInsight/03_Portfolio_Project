// Page orchestration: the cart drawer, the masthead's scroll state, navigation,
// and the cart → assistant handoff.
const App = (() => {
  const el = {};

  function cache() {
    el.masthead = document.getElementById('masthead');
    el.navToggle = document.getElementById('nav-toggle');
    el.navSheet = document.getElementById('nav-sheet');
    el.cartLayer = document.getElementById('cart-layer');
    el.cartPanel = document.getElementById('cart-panel');
    el.cartTrigger = document.getElementById('cart-trigger');
    el.cartCount = document.getElementById('cart-count');
    el.cartSubtitle = document.getElementById('cart-subtitle');
    el.cartBody = document.getElementById('cart-body');
    el.cartFoot = document.getElementById('cart-foot');
    el.cartClose = document.getElementById('cart-close');
    el.cartScrim = document.getElementById('cart-scrim');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Cart drawer --------------------------------------------------------

  function openCart() {
    Overlay.open({
      id: 'cart',
      layer: el.cartLayer,
      panel: el.cartPanel,
      initialFocus: el.cartPanel,
    });
  }

  function closeCart(options) {
    Overlay.close('cart', options);
  }

  function renderCart(items) {
    const count = Cart.getItemCount();
    const total = Cart.getTotal();

    el.cartCount.hidden = count === 0;
    el.cartCount.textContent = count;
    el.cartTrigger.classList.toggle('has-items', count > 0);
    el.cartTrigger.setAttribute(
      'aria-label',
      count === 0 ? 'Your order, empty' : `Your order, ${count} item${count !== 1 ? 's' : ''}`,
    );
    el.cartSubtitle.textContent =
      count === 0 ? 'Nothing added yet' : `${count} item${count !== 1 ? 's' : ''}`;

    if (!items.length) {
      el.cartBody.innerHTML = `
        <div class="cart-empty">
          <span class="cart-empty-mark" aria-hidden="true">
            <svg class="ico ico-lg"><use href="#i-slice"/></svg>
          </span>
          <p class="cart-empty-title">Nothing here yet</p>
          <p class="cart-empty-sub">Pick a pizza from the menu and add any extras you like.</p>
          <button class="btn btn-outline" type="button" id="cart-browse" style="margin-top:var(--s-4)">
            Browse the menu
            <svg class="ico ico-sm" aria-hidden="true"><use href="#i-arrow"/></svg>
          </button>
        </div>`;
      el.cartBody.querySelector('#cart-browse').addEventListener('click', () => {
        closeCart();
        Motion.scrollToSection('menu');
      });
      el.cartFoot.hidden = true;
      return;
    }

    el.cartBody.innerHTML = `<div class="cart-list">${items
      .map((item) => {
        const extrasTotal = item.extras.length * EXTRA_INGREDIENT_PRICE;
        const unit = item.pizza.price + extrasTotal;
        // Decorative: the dish name is right beside it, so the alt stays empty.
        // At 56px the browser takes the 160px variant — about 10 KB.
        const thumb = pizzaPicture(item.pizza.name, { sizes: '56px', alt: '' });

        return `
          <article class="cart-item">
            <div class="cart-thumb">${thumb}</div>
            <div class="cart-item-head">
              <div>
                <h3 class="cart-item-name">${escapeHtml(item.pizza.name)}</h3>
                ${
                  item.extras.length
                    ? `<p class="cart-item-extras">plus ${item.extras.map(escapeHtml).join(', ')}</p>`
                    : ''
                }
              </div>
              <span class="cart-item-price t-num">${formatPrice(unit * item.quantity)}</span>
            </div>
            <div class="cart-item-foot">
              <div class="stepper">
                <button type="button" data-decrease="${item.id}" aria-label="One fewer ${escapeHtml(item.pizza.name)}">
                  <svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg>
                </button>
                <span class="stepper-value t-num">${item.quantity}</span>
                <button type="button" data-increase="${item.id}" aria-label="One more ${escapeHtml(item.pizza.name)}">
                  <svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg>
                </button>
              </div>
              <span class="cart-item-each t-num">${formatPrice(unit)} each</span>
              <button class="icon-btn icon-btn-danger" type="button" data-remove="${item.id}"
                      aria-label="Remove ${escapeHtml(item.pizza.name)} from your order">
                <svg class="ico ico-sm" aria-hidden="true"><use href="#i-trash"/></svg>
              </button>
            </div>
          </article>`;
      })
      .join('')}</div>`;

    el.cartBody.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const item = items.find((i) => i.id === btn.dataset.remove);
        Cart.removeItem(btn.dataset.remove);
        if (item) Motion.announce(`${item.pizza.name} removed.`);
      }),
    );
    el.cartBody.querySelectorAll('[data-increase]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const item = items.find((i) => i.id === btn.dataset.increase);
        if (item) Cart.updateQuantity(item.id, item.quantity + 1);
      }),
    );
    el.cartBody.querySelectorAll('[data-decrease]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const item = items.find((i) => i.id === btn.dataset.decrease);
        if (!item) return;
        if (item.quantity > 1) Cart.updateQuantity(item.id, item.quantity - 1);
        else Cart.removeItem(item.id);
      }),
    );

    el.cartFoot.hidden = false;
    el.cartFoot.innerHTML = `
      <dl class="cart-total-row">
        <dt>Order total</dt>
        <dd class="t-num">${formatPrice(total)}</dd>
      </dl>
      <p class="cart-handoff">
        <svg class="ico ico-sm" aria-hidden="true"><use href="#i-chat"/></svg>
        <span>We'll pass this to the kitchen, who will confirm delivery or pickup with you.</span>
      </p>
      <button class="btn btn-primary btn-block btn-lg" type="button" id="cart-send">
        Send order to the kitchen
        <svg class="ico ico-sm" aria-hidden="true"><use href="#i-arrow"/></svg>
      </button>
      <button class="btn-text" type="button" id="cart-clear">Clear all items</button>`;

    el.cartFoot.querySelector('#cart-send').addEventListener('click', handleHandoff);
    el.cartFoot.querySelector('#cart-clear').addEventListener('click', () => {
      Cart.clearCart();
      Motion.announce('Order cleared.');
    });
  }

  // Popularity tracking. Best-effort by design: it must never block or fail
  // the order. Unchanged from the original.
  function recordOrderCounts(items) {
    const payload = {
      items: items.map((item) => ({ pizza: item.pizza.name, quantity: item.quantity })),
    };
    CONFIG.ready
      .then(() =>
        fetch(`${CONFIG.API_BASE}/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.API_KEY },
          body: JSON.stringify(payload),
        }),
      )
      .catch(() => {
        /* popularity tracking should not stand between a customer and an order */
      });
  }

  // The focal moment: the drawer leaves to the right and the assistant rises
  // from its dock with the composed order already in the input, so the two
  // surfaces read as one continuous move rather than two unrelated toggles.
  function handleHandoff() {
    const items = Cart.getItems();
    if (!items.length) return;

    const orderText = items
      .map((item) => {
        const extras = item.extras.length ? ` with extra ${item.extras.join(', ')}` : '';
        const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
        return `${qty}${item.pizza.name}${extras}`;
      })
      .join(', ');

    recordOrderCounts(items);
    Chat.stageOrder(`I'd like to order: ${orderText}. My total is ${formatPrice(Cart.getTotal())}.`);

    closeCart({ keepFocus: true });
    Motion.announce('Your order has been passed to the kitchen assistant.');
    setTimeout(() => Chat.open({ handoff: true }), Motion.reduced() ? 0 : 160);
  }

  // --- Masthead and navigation -------------------------------------------

  function initMasthead() {
    let ticking = false;
    const update = () => {
      el.masthead.classList.toggle('is-settled', window.scrollY > 16);
      ticking = false;
    };
    update();
    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true },
    );
  }

  function closeNavSheet() {
    el.navSheet.hidden = true;
    el.navToggle.setAttribute('aria-expanded', 'false');
    el.navToggle.setAttribute('aria-label', 'Open navigation');
  }

  function initNav() {
    document.querySelectorAll('[data-scroll]').forEach((node) => {
      node.addEventListener('click', () => {
        closeNavSheet();
        Motion.scrollToSection(node.dataset.scroll);
      });
    });

    document.getElementById('wordmark').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: Motion.reduced() ? 'auto' : 'smooth' });
    });

    el.navToggle.addEventListener('click', () => {
      const open = el.navSheet.hidden;
      el.navSheet.hidden = !open;
      el.navToggle.setAttribute('aria-expanded', String(open));
      el.navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !el.navSheet.hidden) {
        closeNavSheet();
        el.navToggle.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (el.navSheet.hidden) return;
      if (!el.navSheet.contains(e.target) && !el.navToggle.contains(e.target)) closeNavSheet();
    });

    // Marks the section currently being read, so the nav reports position
    // instead of only accepting clicks.
    const sections = ['story', 'menu', 'contact']
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (sections.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            document.querySelectorAll('.nav-link').forEach((link) => {
              link.setAttribute('aria-current', String(link.dataset.scroll === entry.target.id));
            });
          });
        },
        { rootMargin: '-45% 0px -50% 0px' },
      );
      sections.forEach((section) => io.observe(section));
    }

    // Both "ask" entry points on the page open the same assistant.
    ['hero-ask', 'story-ask', 'nav-ask'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => {
        closeNavSheet();
        Chat.open();
      });
    });
  }

  function initCart() {
    el.cartTrigger.addEventListener('click', openCart);
    el.cartClose.addEventListener('click', () => closeCart());
    el.cartScrim.addEventListener('click', () => closeCart());
    Cart.onChange(renderCart);
    renderCart(Cart.getItems());
  }

  function init() {
    cache();
    Motion.initReveals();
    initMasthead();
    initNav();
    initCart();
    Chat.init();
    Menu.init();
    Shop.init();
  }

  return { init, openCart, closeCart };
})();

document.addEventListener('DOMContentLoaded', App.init);
