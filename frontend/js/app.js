const App = (() => {
  const cartOverlay = document.getElementById('cart-overlay');
  const cartBackdrop = document.getElementById('cart-backdrop');
  const cartOpenBtn = document.getElementById('cart-open-btn');
  const cartCloseBtn = document.getElementById('cart-close-btn');
  const cartBadge = document.getElementById('cart-badge');
  const cartCount = document.getElementById('cart-count');
  const cartItemsEl = document.getElementById('cart-items');
  const cartFooter = document.getElementById('cart-footer');
  const cartTotalEl = document.getElementById('cart-total');
  const cartOrderBtn = document.getElementById('cart-order-btn');
  const cartClearBtn = document.getElementById('cart-clear-btn');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function openCart() {
    cartOverlay.hidden = false;
  }

  function closeCart() {
    cartOverlay.hidden = true;
  }

  function renderCart(items) {
    const total = Cart.getTotal();
    const count = Cart.getItemCount();

    cartBadge.hidden = count === 0;
    cartBadge.textContent = count;

    if (count > 0) {
      cartCount.hidden = false;
      cartCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    } else {
      cartCount.hidden = true;
    }

    if (items.length === 0) {
      cartItemsEl.innerHTML = `
        <div class="cart-empty">
          <span class="cart-empty-emoji">🍕</span>
          <p class="cart-empty-title">Your order is empty</p>
          <p class="cart-empty-sub">Add some pizzas from the menu</p>
          <button class="btn-link" id="cart-browse-btn">Browse Menu →</button>
        </div>
      `;
      cartItemsEl.querySelector('#cart-browse-btn').addEventListener('click', closeCart);
      cartFooter.hidden = true;
      return;
    }

    cartItemsEl.innerHTML = items
      .map((item) => {
        const extrasTotal = item.extras.length * EXTRA_INGREDIENT_PRICE;
        const itemTotal = (item.pizza.price + extrasTotal) * item.quantity;
        const extrasLine = item.extras.length
          ? `<p class="cart-item-extras">+ ${item.extras.map(escapeHtml).join(', ')}</p>`
          : '';

        return `
          <div class="cart-item">
            <div class="cart-item-top">
              <div class="cart-item-info">
                <h3 class="cart-item-name">${escapeHtml(item.pizza.name)}</h3>
                ${extrasLine}
              </div>
              <div class="cart-item-actions">
                <span class="cart-item-price">$${itemTotal.toFixed(2)}</span>
                <button class="icon-btn icon-btn-ghost" data-remove="${item.id}" aria-label="Remove item">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
            <div class="cart-item-qty">
              <button class="qty-btn" data-decrease="${item.id}" aria-label="Decrease quantity">−</button>
              <span class="qty-value">${item.quantity}</span>
              <button class="qty-btn" data-increase="${item.id}" aria-label="Increase quantity">+</button>
              <span class="cart-item-each">$${(item.pizza.price + extrasTotal).toFixed(2)} each</span>
            </div>
          </div>
        `;
      })
      .join('');

    cartItemsEl.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', () => Cart.removeItem(btn.dataset.remove)),
    );
    cartItemsEl.querySelectorAll('[data-increase]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const item = items.find((i) => i.id === btn.dataset.increase);
        Cart.updateQuantity(item.id, item.quantity + 1);
      }),
    );
    cartItemsEl.querySelectorAll('[data-decrease]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const item = items.find((i) => i.id === btn.dataset.decrease);
        item.quantity > 1 ? Cart.updateQuantity(item.id, item.quantity - 1) : Cart.removeItem(item.id);
      }),
    );

    cartFooter.hidden = false;
    cartTotalEl.textContent = `$${total.toFixed(2)}`;
  }

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
        /* best-effort — popularity tracking shouldn't block placing the order */
      });
  }

  function handleOrderViaChat() {
    const items = Cart.getItems();
    const orderText = items
      .map((item) => {
        const extrasText = item.extras.length ? ` with extra ${item.extras.join(', ')}` : '';
        const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
        return `${qty}${item.pizza.name}${extrasText}`;
      })
      .join(', ');

    recordOrderCounts(items);

    sessionStorage.setItem(
      'pending_order',
      `I'd like to order: ${orderText}. My total is $${Cart.getTotal().toFixed(2)}.`,
    )
    closeCart();
    setTimeout(() => Chat.open(), 150);
  }

  function initHeader() {
    document.querySelectorAll('[data-scroll]').forEach((el) => {
      el.addEventListener('click', () => {
        document.getElementById(el.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' });
      });
    });
    document.getElementById('logo-btn').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initCart() {
    cartOpenBtn.addEventListener('click', openCart);
    cartCloseBtn.addEventListener('click', closeCart);
    cartBackdrop.addEventListener('click', closeCart);
    cartOrderBtn.addEventListener('click', handleOrderViaChat);
    cartClearBtn.addEventListener('click', () => Cart.clearCart());
    Cart.onChange(renderCart);
    renderCart(Cart.getItems());
  }

  function init() {
    initHeader();
    initCart();
    Menu.init();
    Footer.init();
    Chat.init();
  }

  return { init, openCart, closeCart };
})();

document.addEventListener('DOMContentLoaded', App.init);
