const EXTRA_INGREDIENT_PRICE = 1.0;

const PIZZA_THEMES = {
  Margherita: { gradient: 'theme-green', emoji: '🌿' },
  'Prosciutto Cotto': { gradient: 'theme-rose', emoji: '🥩' },
  'Quattro Formaggi': { gradient: 'theme-amber', emoji: '🧀' },
  Pepperoni: { gradient: 'theme-red', emoji: '🌶️' },
  Hawaiian: { gradient: 'theme-orange', emoji: '🍍' },
  Vegetarian: { gradient: 'theme-teal', emoji: '🥦' },
};

function getPizzaTheme(name) {
  return PIZZA_THEMES[name] || { gradient: 'theme-stone', emoji: '🍕' };
}

const PIZZA_IMAGES = {
  Margherita: 'images/pizza_margherita.png',
  'Prosciutto Cotto': 'images/pizza_prosciutto.png',
  'Quattro Formaggi': 'images/pizza_4formaggi.png',
  Pepperoni: 'images/pizza_pepperoni.png',
  Hawaiian: 'images/pizza_hawaiian.png',
  Vegetarian: 'images/pizza_vegetarian.png',
  Capricciosa: 'images/pizza_capricciosa.png',
};

function getPizzaImage(name) {
  return PIZZA_IMAGES[name] || null;
}
