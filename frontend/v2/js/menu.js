// Menu rendering and the customise sheet.
//
// The menu's concept is deliberately unchanged from the original: a photo-led
// card grid, the price beside the name, ingredient tags, one customise action
// per card, and the same /menu-data request behind it.
const Menu = (() => {
  let menuData = { ingredients: [], pizzas: [], shop: {} };
  let loadError = '';
  // Name of the most-ordered pizza, from real order data. '' when nothing has
  // been ordered yet or the request failed, in which case no card is badged.
  let popular = '';

  // What each image slot actually occupies, so the browser can pick the right
  // width from the srcset instead of always fetching the largest file.
  const SIZES = {
    card: '(min-width: 64rem) 30vw, (min-width: 40rem) 46vw, 92vw',
    feature: '(min-width: 48rem) 46vw, 92vw',
    sheet: '(min-width: 48rem) 20rem, 100vw',
  };

  const grid = () => document.getElementById('menu-grid');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Grid ---------------------------------------------------------------

  function skeletonMarkup() {
    return Array.from({ length: 6 })
      .map(
        () => `
        <div class="pizza-skeleton" aria-hidden="true">
          <div class="sk-media"></div>
          <div class="sk-body">
            <div class="sk-line"></div>
            <div class="sk-line is-short"></div>
            <div class="sk-line is-btn"></div>
          </div>
        </div>`,
      )
      .join('');
  }

  // At most one flag per card. "Most ordered" is measured from /order-counts,
  // so it outranks the editorial "House classic" when they land on the same
  // pizza — otherwise the feature card would wear two badges.
  function flagMarkup(pizza, isFeature) {
    if (popular && pizza.name === popular) {
      return `<span class="pizza-flag is-popular"><svg class="ico" aria-hidden="true"><use href="#i-spark"/></svg>Most ordered</span>`;
    }
    if (isFeature) {
      return `<span class="pizza-flag"><svg class="ico" aria-hidden="true"><use href="#i-spark"/></svg>House classic</span>`;
    }
    return '';
  }

  function mediaMarkup(pizza, isFeature) {
    const flag = flagMarkup(pizza, isFeature);

    const picture = pizzaPicture(pizza.name, {
      sizes: isFeature ? SIZES.feature : SIZES.card,
    });

    if (!picture) {
      return `<div class="pizza-media">
        <div class="pizza-fallback"><svg class="ico" aria-hidden="true"><use href="#i-slice"/></svg></div>
        ${flag}
      </div>`;
    }

    return `<div class="pizza-media">${picture}${flag}</div>`;
  }

  function cardMarkup(pizza, index) {
    const isFeature = index === 0;
    const note = getPizzaNote(pizza.name);
    const tags = pizza.ingredients
      .map((ing) => `<li class="tag">${escapeHtml(ing)}</li>`)
      .join('');

    return `
      <article class="pizza-card reveal${isFeature ? ' is-feature' : ''}">
        ${mediaMarkup(pizza, isFeature)}
        <div class="pizza-body">
          <div class="pizza-head">
            <h3 class="pizza-name">${escapeHtml(pizza.name)}</h3>
            <span class="pizza-leader" aria-hidden="true"></span>
            <span class="pizza-price t-num">${formatPrice(pizza.price)}</span>
          </div>
          ${note && isFeature ? `<p class="t-body">${escapeHtml(note)}</p>` : ''}
          <ul class="pizza-tags">${tags}</ul>
          <button class="btn btn-outline" type="button" data-pizza="${escapeHtml(pizza.name)}">
            Customise &amp; order
          </button>
        </div>
      </article>`;
  }

  function renderGrid() {
    const target = grid();
    if (!target) return;

    if (loadError) {
      target.innerHTML = `
        <div class="menu-status notice notice-error" role="alert">
          <svg class="ico" aria-hidden="true"><use href="#i-alert"/></svg>
          <span>${escapeHtml(loadError)}</span>
        </div>`;
      return;
    }

    if (!menuData.pizzas.length) {
      target.innerHTML = skeletonMarkup();
      return;
    }

    target.innerHTML = menuData.pizzas.map(cardMarkup).join('');

    const cards = [...target.querySelectorAll('.pizza-card')];
    Motion.stagger(cards);
    Motion.initReveals();

    target.querySelectorAll('[data-pizza]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pizza = menuData.pizzas.find((p) => p.name === btn.dataset.pizza);
        if (pizza) openSheet(pizza, btn);
      });
    });
  }

  // --- Customise sheet ----------------------------------------------------

  function openSheet(pizza, opener) {
    const layer = document.getElementById('sheet-layer');
    const sheet = document.getElementById('sheet');
    const availableExtras = menuData.ingredients.filter((ing) => !pizza.ingredients.includes(ing));
    let selected = [];

    const picture = pizzaPicture(pizza.name, { sizes: SIZES.sheet });
    const note = getPizzaNote(pizza.name);

    // Extras are grouped so a sixteen-item list can be scanned by kind rather
    // than read end to end. Selection itself is unchanged: one flat array.
    const groups = groupExtras(availableExtras);

    const extrasMarkup = groups
      .map(
        (group) => `
        <div class="extra-group">
          <h4 class="extra-group-label">${escapeHtml(group.label)}</h4>
          <div class="extras-row">
            ${group.items
              .map(
                (ing) => `
                <button class="extra" type="button" data-ing="${escapeHtml(ing)}" aria-pressed="false">
                  <span class="extra-mark" aria-hidden="true"><svg class="ico"><use href="#i-check"/></svg></span>
                  ${escapeHtml(ing)}
                </button>`,
              )
              .join('')}
          </div>
        </div>`,
      )
      .join('');

    sheet.innerHTML = `
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-media">
        ${
          picture ||
          `<div class="pizza-fallback"><svg class="ico" aria-hidden="true"><use href="#i-slice"/></svg></div>`
        }
      </div>
      <div class="sheet-col">
        <header class="sheet-head">
          <div>
            <p class="sheet-kicker">Customise your pizza</p>
            <h2 class="sheet-title" id="sheet-title">${escapeHtml(pizza.name)}</h2>
          </div>
          <button class="icon-btn" type="button" data-close aria-label="Close without adding">
            <svg class="ico" aria-hidden="true"><use href="#i-close"/></svg>
          </button>
        </header>

        <div class="sheet-body">
          ${note ? `<p class="sheet-note">${escapeHtml(note)}</p>` : ''}

          <section class="sheet-section">
            <h3 class="sheet-label">Already on it</h3>
            <ul class="chip-row">
              ${pizza.ingredients.map((ing) => `<li class="tag tag-included">${escapeHtml(ing)}</li>`).join('')}
            </ul>
          </section>

          <section class="sheet-section">
            <h3 class="sheet-label">
              Add extras
              <span class="sheet-label-note t-num">${formatPrice(EXTRA_INGREDIENT_PRICE)} each</span>
            </h3>
            ${extrasMarkup}
          </section>
        </div>

        <footer class="sheet-foot">
          <p class="sheet-readback" id="sheet-readback"><span></span></p>
          <div class="sheet-summary">
            <span class="sheet-breakdown t-num" id="sheet-breakdown"></span>
            <span class="sheet-total">
              <span class="sheet-total-label">Total</span>
              <span class="sheet-total-value t-num" id="sheet-total"></span>
            </span>
          </div>
          <button class="btn btn-primary btn-block btn-lg" type="button" id="sheet-add"></button>
        </footer>
      </div>`;

    const readback = sheet.querySelector('#sheet-readback span');
    const breakdown = sheet.querySelector('#sheet-breakdown');
    const totalEl = sheet.querySelector('#sheet-total');
    const addBtn = sheet.querySelector('#sheet-add');

    // Patches only what changed, so toggling an extra never rebuilds the sheet
    // and never steals keyboard focus off the control you just pressed.
    function sync() {
      const extrasTotal = selected.length * EXTRA_INGREDIENT_PRICE;
      const total = pizza.price + extrasTotal;

      readback.innerHTML = selected.length
        ? `<b>${escapeHtml(pizza.name)}</b> with <em>${selected.map(escapeHtml).join(', ')}</em>.`
        : `<b>${escapeHtml(pizza.name)}</b> just as it comes. Add extras above if you like.`;

      breakdown.textContent = selected.length
        ? `${formatPrice(pizza.price)} + ${selected.length} extra${selected.length !== 1 ? 's' : ''} ${formatPrice(extrasTotal)}`
        : `${formatPrice(pizza.price)} base`;

      totalEl.textContent = formatPrice(total);
      addBtn.textContent = `Add to order — ${formatPrice(total)}`;
    }

    sheet.querySelectorAll('.extra').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ing = btn.dataset.ing;
        const next = !selected.includes(ing);
        selected = next ? [...selected, ing] : selected.filter((e) => e !== ing);
        btn.setAttribute('aria-pressed', String(next));
        sync();
      });
    });

    sheet.querySelector('[data-close]').addEventListener('click', () => closeSheet());

    addBtn.addEventListener('click', () => {
      Cart.addItem(pizza, selected);
      Motion.flyToCart(sheet.querySelector('.sheet-media'), `${IMAGE_BASE}/webp/${PIZZA_IMAGES[pizza.name]}-160.webp`);
      Motion.announce(`${pizza.name} added to your order.`);
      closeSheet();
    });

    sync();

    Overlay.open({
      id: 'sheet',
      layer,
      panel: sheet,
      initialFocus: sheet,
      returnTo: opener,
      onClose: () => {
        sheet.innerHTML = '';
      },
    });

    document.getElementById('sheet-scrim').onclick = () => closeSheet();
  }

  function closeSheet() {
    Overlay.close('sheet');
  }

  // --- Load ---------------------------------------------------------------

  async function init() {
    renderGrid(); // skeletons first, so the section keeps its shape

    // Both in flight together, and settled rather than raced: the badge is a
    // bonus, so a popularity failure must never delay or break the menu.
    const [menuResult, popularResult] = await Promise.allSettled([
      fetch(`${CONFIG.API_BASE}/menu-data`).then((res) => {
        if (!res.ok) throw new Error(`Menu request failed with ${res.status}`);
        return res.json();
      }),
      fetch(`${CONFIG.API_BASE}/order-counts`).then((res) => (res.ok ? res.json() : null)),
    ]);

    if (menuResult.status === 'fulfilled') {
      menuData = menuResult.value;
      loadError = '';
    } else {
      loadError =
        'We could not load the menu. Start the backend at http://127.0.0.1:8000 and reload this page.';
    }

    // The endpoint ranks but never returns counts, so the page can say what is
    // ordered most without publishing how much of it is sold.
    popular =
      popularResult.status === 'fulfilled' && popularResult.value?.ranked?.length
        ? popularResult.value.ranked[0].pizza
        : '';

    renderGrid();

    // The hero's plate names a real pizza at its real price, so it has to come
    // from the same data as the grid rather than being written into the HTML.
    const lead = menuData.pizzas[0];
    if (lead) {
      const nameEl = document.getElementById('hero-plate-name');
      const priceEl = document.getElementById('hero-plate-price');
      if (nameEl) nameEl.textContent = lead.name;
      if (priceEl) priceEl.textContent = formatPrice(lead.price);
    }
  }

  return {
    init,
    closeSheet,
    get data() {
      return menuData;
    },
  };
})();
