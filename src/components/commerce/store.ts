/* eslint-disable no-restricted-globals */
"use client";

import { useEffect, useMemo, useState } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
};

export type Cart = {
  items: CartItem[];
};

export type Order = {
  id: string;
  status: string;
  vendor: string;
  total: number;
  address: string;
  createdAt: string;
  items: CartItem[];
  timeline: Array<{ label: string; time: string }>;
};

const CART_KEY = "alpha_cart_v1";
const ORDER_KEY = "alpha_orders_v1";
const CART_EVENT = "alpha-cart-updated";
const ORDER_EVENT = "alpha-orders-updated";

const isBrowser = typeof window !== "undefined";

function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (!isBrowser) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function formatCurrency(amount: number) {
  return `\u20A6${amount.toFixed(2)}`;
}

export function parsePrice(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCart(): Cart {
  return readJSON<Cart>(CART_KEY, { items: [] });
}

export function saveCart(cart: Cart) {
  writeJSON(CART_KEY, cart);
  if (isBrowser) {
    window.dispatchEvent(new Event(CART_EVENT));
  }
  return cart;
}

export function addToCart(item: Omit<CartItem, "qty">, qty = 1) {
  const cart = getCart();
  const existing = cart.items.find((entry) => entry.id === item.id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.items.push({ ...item, qty });
  }
  return saveCart({ ...cart, items: [...cart.items] });
}

export function removeFromCart(id: string) {
  const cart = getCart();
  const updated = cart.items.filter((item) => item.id !== id);
  return saveCart({ items: updated });
}

export function updateCartQty(id: string, qty: number) {
  if (qty <= 0) {
    return removeFromCart(id);
  }
  const cart = getCart();
  const updated = cart.items.map((item) =>
    item.id === id ? { ...item, qty } : item
  );
  return saveCart({ items: updated });
}

export function clearCart() {
  return saveCart({ items: [] });
}

export function cartSubtotal(cart: Cart) {
  return cart.items.reduce((total, item) => total + item.price * item.qty, 0);
}

export function getOrders() {
  return readJSON<Order[]>(ORDER_KEY, []);
}

export function saveOrders(orders: Order[]) {
  writeJSON(ORDER_KEY, orders);
  if (isBrowser) {
    window.dispatchEvent(new Event(ORDER_EVENT));
  }
  return orders;
}

export function getOrderById(id: string) {
  return getOrders().find((order) => order.id === id);
}

export function createOrder({
  address,
  vendor = "Alpha Marketplace",
}: {
  address: string;
  vendor?: string;
}) {
  const cart = getCart();
  if (cart.items.length === 0) {
    throw new Error("Cart is empty.");
  }

  const now = new Date();
  const createdAt = now.toLocaleString();
  const total = cartSubtotal(cart);
  const order: Order = {
    id: `ORD-${now.getTime().toString(36).toUpperCase()}`,
    status: "Processing",
    vendor,
    total,
    address,
    createdAt,
    items: cart.items,
    timeline: [
      { label: "Order placed", time: createdAt },
      { label: "Payment confirmed", time: createdAt },
      { label: "Preparing shipment", time: "Pending" },
      { label: "Out for delivery", time: "Pending" },
    ],
  };

  const orders = getOrders();
  saveOrders([order, ...orders]);
  clearCart();
  return order;
}

function subscribe(eventName: string, callback: () => void) {
  if (!isBrowser) return () => {};
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useCart() {
  const [cart, setCart] = useState<Cart>(() => getCart());

  useEffect(() => subscribe(CART_EVENT, () => setCart(getCart())), []);

  return cart;
}

export function useCartCount() {
  const cart = useCart();
  return useMemo(
    () => cart.items.reduce((count, item) => count + item.qty, 0),
    [cart.items]
  );
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(() => getOrders());

  useEffect(() => subscribe(ORDER_EVENT, () => setOrders(getOrders())), []);

  return orders;
}

export function useOrder(id: string) {
  const orders = useOrders();
  return useMemo(
    () => orders.find((order) => order.id === id),
    [orders, id]
  );
}
