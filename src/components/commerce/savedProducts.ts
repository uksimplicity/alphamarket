"use client";
import { useCallback, useSyncExternalStore } from "react";
import { getAuth, AUTH_UPDATED_EVENT } from "@/components/auth/authStorage";
import type { Product } from "@/components/products/catalog";

const event = "alpha-saved-products-updated";
const empty: Product[] = [];
let cachedKey = "", cachedRaw = "", cachedItems = empty;
const key = () => `alpha.saved-products.v1:${getAuth()?.user.id || "guest"}`;
function snapshot() {
  if (typeof window === "undefined") return empty;
  const owner = key();
  let raw = ""; try { raw = localStorage.getItem(owner) || ""; } catch { return empty; }
  if (cachedKey === owner && cachedRaw === raw) return cachedItems;
  cachedKey = owner; cachedRaw = raw;
  try { const parsed = JSON.parse(raw || "[]"); cachedItems = Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.price === "string" && item.seller) : empty; } catch { cachedItems = empty; }
  return cachedItems;
}
function subscribe(callback: () => void) {
  window.addEventListener(event, callback); window.addEventListener("storage", callback); window.addEventListener(AUTH_UPDATED_EVENT, callback);
  return () => { window.removeEventListener(event, callback); window.removeEventListener("storage", callback); window.removeEventListener(AUTH_UPDATED_EVENT, callback); };
}
export function useSavedProducts() {
  const products = useSyncExternalStore(subscribe, snapshot, () => empty);
  const toggle = useCallback((product: Product) => {
    const current = snapshot();
    const next = current.some(item => item.id === product.id) ? current.filter(item => item.id !== product.id) : [product, ...current];
    try { localStorage.setItem(key(), JSON.stringify(next)); window.dispatchEvent(new Event(event)); }
    catch { throw new Error("Your browser couldn't save this item. Check your storage settings and try again."); }
  }, []);
  return { products, toggle };
}
