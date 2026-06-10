export interface CartItem {
  id: number;
  productName: string;
  objectName?: string;
  varietyName?: string;
  categoryName?: string;
  wholepart: number;
  copecks: number;
  quantityAvailable: number;
  quantity: number;
  unit: string;
  placeAddress?: string;
  supplierName?: string;
  supplierId?: number;
}

const KEY = 'buyer_market_cart';

export function getCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addToCart(item: CartItem) {
  const items = getCart();
  const existing = items.find((x) => x.id === item.id);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + item.quantity, existing.quantityAvailable);
  } else {
    items.push(item);
  }

  saveCart(items);
  return items;
}

export function updateCartQuantity(id: number, quantity: number) {
  const items = getCart().map((item) =>
    item.id === id
      ? { ...item, quantity: Math.max(1, Math.min(quantity, item.quantityAvailable)) }
      : item
  );
  saveCart(items);
  return items;
}

export function removeFromCart(id: number) {
  const items = getCart().filter((item) => item.id !== id);
  saveCart(items);
  return items;
}

export function clearCart() {
  saveCart([]);
}