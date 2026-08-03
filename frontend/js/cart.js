const Cart = (() => {
  let items = [];
  const listeners = [];

  function onChange(fn) {
    listeners.push(fn);
  }

  function notify() {
    listeners.forEach((fn) => fn(items));
  }

  function addItem(pizza, extras) {
    const id = `${pizza.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    items.push({ id, pizza, extras, quantity: 1 });
    notify();
  }

  function removeItem(id) {
    items = items.filter((item) => item.id !== id);
    notify();
  }

  function updateQuantity(id, quantity) {
    if (quantity < 1) return;
    items = items.map((item) => (item.id === id ? { ...item, quantity } : item));
    notify();
  }

  function clearCart() {
    items = [];
    notify();
  }

  function getItems() {
    return items;
  }

  function getTotal() {
    return items.reduce((sum, item) => {
      const extrasTotal = item.extras.length * EXTRA_INGREDIENT_PRICE;
      return sum + (item.pizza.price + extrasTotal) * item.quantity;
    }, 0);
  }

  function getItemCount() {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }

  return { addItem, removeItem, updateQuantity, clearCart, getItems, getTotal, getItemCount, onChange };
})();
