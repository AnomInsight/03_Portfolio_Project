const Menu = (() => {
  let menuData = { ingredients: [], pizzas: [], shop: {} };
  let menuLoadError = '';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderPizzaGrid() {
    const grid = document.getElementById('pizza-grid');
    if (menuLoadError) {
      grid.innerHTML = `<p class="menu-loading">${menuLoadError}</p>`;
      return;
    }

    if (!menuData.pizzas.length) {
      grid.innerHTML = '<p class="menu-loading">Loading menu...</p>';
      return;
    }

    grid.innerHTML = menuData.pizzas
      .map((pizza) => {
        const theme = getPizzaTheme(pizza.name);
        const image = getPizzaImage(pizza.name);
        const media = image
          ? `<img src="${image}" alt="${escapeHtml(pizza.name)}" class="pizza-photo" />
             <div class="pizza-photo-fade"></div>`
          : `<div class="pizza-theme ${theme.gradient}">
               <span class="pizza-emoji">🍕</span>
               <span class="pizza-theme-badge">${theme.emoji}</span>
             </div>`;

        const tags = pizza.ingredients
          .map((ing) => `<span class="tag">${escapeHtml(ing)}</span>`)
          .join('');

        return `
          <div class="pizza-card">
            <div class="pizza-media">${media}</div>
            <div class="pizza-body">
              <div class="pizza-head">
                <h3 class="pizza-name">${escapeHtml(pizza.name)}</h3>
                <span class="pizza-price">$${pizza.price.toFixed(2)}</span>
              </div>
              <div class="pizza-tags">${tags}</div>
              <button class="btn btn-dark btn-block pizza-order-btn" data-pizza="${escapeHtml(pizza.name)}">
                Customize &amp; Order
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    grid.querySelectorAll('.pizza-order-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pizza = menuData.pizzas.find((p) => p.name === btn.dataset.pizza);
        if (pizza) openCustomizeModal(pizza);
      });
    });
  }

  function openCustomizeModal(pizza) {
    const overlay = document.getElementById('customize-overlay');
    const sheet = document.getElementById('customize-sheet');
    const backdrop = document.getElementById('customize-backdrop');
    const availableExtras = menuData.ingredients.filter((ing) => !pizza.ingredients.includes(ing));
    let selectedExtras = [];

    const image = getPizzaImage(pizza.name);
    const theme = getPizzaTheme(pizza.name);
    const imageColMedia = image
      ? `<img src="${image}" alt="${escapeHtml(pizza.name)}" class="modal-image-photo" />`
      : `<div class="modal-image-fallback ${theme.gradient}">${theme.emoji}</div>`;

    function priceBreakdown() {
      const extrasTotal = selectedExtras.length * EXTRA_INGREDIENT_PRICE;
      const total = pizza.price + extrasTotal;
      return { extrasTotal, total };
    }

    function render() {
      const { extrasTotal, total } = priceBreakdown();

      sheet.innerHTML = `
        <div class="modal-drag-handle"></div>
        <div class="modal-main">
          <div class="modal-image-col">${imageColMedia}</div>
          <div class="modal-content-col">
            <div class="modal-head">
              <div>
                <h2 class="modal-title">Customize Your Pizza</h2>
                <p class="modal-subtitle">${escapeHtml(pizza.name)}</p>
              </div>
              <button class="icon-btn" id="customize-close-btn" aria-label="Close">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div class="modal-body">
              <div class="modal-section">
                <p class="modal-label">Base ingredients (included)</p>
                <div class="chip-row">
                  ${pizza.ingredients.map((ing) => `<span class="chip">${escapeHtml(ing)}</span>`).join('')}
                </div>
              </div>

              <div class="modal-section">
                <p class="modal-label">Add extras <span class="modal-label-note">(+$${EXTRA_INGREDIENT_PRICE.toFixed(2)} each)</span></p>
                <div class="extras-grid">
                  ${availableExtras
                    .map((ing) => {
                      const checked = selectedExtras.includes(ing);
                      return `
                        <button type="button" class="extra-btn ${checked ? 'checked' : ''}" data-ing="${escapeHtml(ing)}">
                          <span class="extra-check">${checked ? '✓' : ''}</span>
                          ${escapeHtml(ing)}
                        </button>
                      `;
                    })
                    .join('')}
                </div>
              </div>

              <div class="price-box">
                <div class="price-row"><span>Base price</span><span>$${pizza.price.toFixed(2)}</span></div>
                ${
                  extrasTotal > 0
                    ? `<div class="price-row"><span>${selectedExtras.length} extra${selectedExtras.length !== 1 ? 's' : ''}</span><span>+$${extrasTotal.toFixed(2)}</span></div>`
                    : ''
                }
                <div class="price-row price-row-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
              </div>

              <button class="btn btn-primary btn-block btn-lg" id="customize-add-btn">
                Add to Order — $${total.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      `;

      sheet.querySelector('#customize-close-btn').addEventListener('click', closeCustomizeModal);
      sheet.querySelectorAll('.extra-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const ing = btn.dataset.ing;
          selectedExtras = selectedExtras.includes(ing)
            ? selectedExtras.filter((e) => e !== ing)
            : [...selectedExtras, ing];
          render();
        });
      });
      sheet.querySelector('#customize-add-btn').addEventListener('click', () => {
        Cart.addItem(pizza, selectedExtras);
        closeCustomizeModal();
        App.openCart();
      });
    }

    render();
    overlay.hidden = false;
    backdrop.onclick = closeCustomizeModal;
  }

  function closeCustomizeModal() {
    document.getElementById('customize-overlay').hidden = true;
    document.getElementById('customize-sheet').innerHTML = '';
  }

  async function init() {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/menu-data`);
      if (res.ok) {
        menuData = await res.json();
        menuLoadError = '';
      } else {
        throw new Error(`Menu request failed with ${res.status}`);
      }
    } catch (e) {
      menuLoadError = 'Menu unavailable. Start the backend at http://127.0.0.1:8000 and reload this page.';
    }

    renderPizzaGrid();
  }

  return { init, renderPizzaGrid, closeCustomizeModal, get data() { return menuData; } };
})();
