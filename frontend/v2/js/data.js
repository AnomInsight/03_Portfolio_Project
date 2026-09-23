// Presentation-only lookups. The menu itself (names, ingredients, prices) is
// always the backend's; nothing here may invent or override a menu fact.

const EXTRA_INGREDIENT_PRICE = 1.0;

// Images are shared with the original version, one level up. Version B reads
// the optimised WebP set in images/webp/ and keeps the source PNG as the
// <picture> fallback, so the original keeps working untouched.
const IMAGE_BASE = '../images';

// --- Photography ------------------------------------------------------------
// Each entry is the file stem; the responsive widths that exist on disk are
// listed alongside so the srcset never points at a file that was not generated.

const PIZZA_IMAGES = {
  Margherita: 'pizza_margherita',
  'Prosciutto Cotto': 'pizza_prosciutto',
  'Quattro Formaggi': 'pizza_4formaggi',
  Pepperoni: 'pizza_pepperoni',
  Hawaiian: 'pizza_hawaiian',
  Vegetarian: 'pizza_vegetarian',
  Capricciosa: 'pizza_capricciosa',
};

const PIZZA_WIDTHS = [160, 480, 800, 1254];
const PIZZA_INTRINSIC = { w: 1254, h: 1254 };

function getPizzaImage(name) {
  return PIZZA_IMAGES[name] || null;
}

/**
 * Responsive <picture> markup for a pizza photograph.
 *
 * `display: contents` on the <picture> means every existing `img` rule in the
 * stylesheet still applies, so adding the WebP sources changed no layout.
 *
 * @param {string} name     pizza name, as the backend spells it
 * @param {object} opts
 * @param {string} opts.sizes   the CSS `sizes` attribute for this slot
 * @param {string} [opts.alt]   empty string marks the image decorative
 * @param {'lazy'|'eager'} [opts.loading]
 */
function pizzaPicture(name, opts) {
  const stem = PIZZA_IMAGES[name];
  if (!stem) return '';

  const srcset = PIZZA_WIDTHS.map((w) => `${IMAGE_BASE}/webp/${stem}-${w}.webp ${w}w`).join(', ');
  const alt = opts.alt === '' ? '' : opts.alt || `${name} pizza`;

  return `<picture>
      <source type="image/webp" srcset="${srcset}" sizes="${opts.sizes}" />
      <img src="${IMAGE_BASE}/${stem}.png" alt="${alt}"
           width="${PIZZA_INTRINSIC.w}" height="${PIZZA_INTRINSIC.h}"
           loading="${opts.loading || 'lazy'}" decoding="async" />
    </picture>`;
}

// --- Copy -------------------------------------------------------------------
// One short line per pizza. Each one describes only what is already in that
// pizza's own ingredient list — no preparation claims, no sourcing claims, and
// nothing about the kitchen that the project data does not state.

const PIZZA_NOTES = {
  Margherita: 'Tomato sauce, mozzarella and basil. The one everything else is measured against.',
  'Prosciutto Cotto': 'Cooked ham over tomato sauce and mozzarella.',
  'Quattro Formaggi': 'Four cheeses, no tomato: mozzarella, gorgonzola, parmesan and fontina.',
  Pepperoni: 'Pepperoni over tomato sauce and mozzarella.',
  Hawaiian: 'Pineapple and cooked ham. We are not going to apologise for it.',
  Vegetarian: 'Mushrooms, onions and olives over tomato sauce and mozzarella.',
  Capricciosa: 'Artichokes, capers and black olives on garlic oil, with ham and mushrooms.',
};

function getPizzaNote(name) {
  return PIZZA_NOTES[name] || '';
}

// --- Extras grouping --------------------------------------------------------
// A display grouping only. The menu's ingredient list still comes entirely from
// the backend, the order of selection is unchanged, and anything the backend
// adds that is not named here still appears under "More" rather than vanishing.

const EXTRA_GROUPS = [
  { label: 'Cheese', members: ['mozzarella', 'gorgonzola', 'parmesan', 'fontina'] },
  { label: 'Meat', members: ['prosciutto cotto', 'pepperoni'] },
  {
    label: 'Vegetables',
    members: ['mushrooms', 'onions', 'artichokes', 'olives', 'black olives', 'capers', 'pineapple'],
  },
  { label: 'Sauce & herbs', members: ['tomato sauce', 'basil', 'garlic oil'] },
];

/**
 * @param {string[]} ingredients the extras available for one pizza
 * @returns {{label: string, items: string[]}[]} only non-empty groups
 */
function groupExtras(ingredients) {
  const claimed = new Set();

  const groups = EXTRA_GROUPS.map((group) => {
    const items = ingredients.filter((ing) => group.members.includes(ing.toLowerCase()));
    items.forEach((ing) => claimed.add(ing));
    return { label: group.label, items };
  }).filter((group) => group.items.length);

  const unclaimed = ingredients.filter((ing) => !claimed.has(ing));
  if (unclaimed.length) groups.push({ label: 'More', items: unclaimed });

  return groups;
}

// --- Formatting -------------------------------------------------------------

function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

// The backend stores hour ranges with a hyphen ("11:00-22:00"). Printed on the
// page they want an en dash, which is what the rest of the type uses.
function formatRange(text) {
  return typeof text === 'string' ? text.replace(/\s*-\s*/g, '–') : text;
}
