"use client";

import Link from "next/link";
import {
  cartSubtotal,
  formatCurrency,
  removeFromCart,
  updateCartQty,
  useCart,
} from "@/components/commerce/store";
import { Button, Card, SectionTitle } from "@/components/dashboard/ui";

export default function CartPage() {
  const cart = useCart();
  const subtotal = formatCurrency(cartSubtotal(cart));

  return (
    <Card>
      <SectionTitle title="Cart" subtitle="Manage items before checkout." />
      <div className="mt-4 space-y-4 text-sm">
        {cart.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
            Your cart is empty. Browse products to get started.
          </div>
        ) : (
          cart.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{item.name}</div>
                <div className="text-slate-500">
                  {formatCurrency(item.price)} Qty {item.qty}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-slate-200">
                  <button
                    type="button"
                    className="px-3 py-1 text-sm font-semibold"
                    onClick={() => updateCartQty(item.id, item.qty - 1)}
                  >
                    -
                  </button>
                  <span className="px-3 text-sm font-semibold">{item.qty}</span>
                  <button
                    type="button"
                    className="px-3 py-1 text-sm font-semibold"
                    onClick={() => updateCartQty(item.id, item.qty + 1)}
                  >
                    +
                  </button>
                </div>
                <Button variant="ghost" onClick={() => removeFromCart(item.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
          <span className="font-semibold text-slate-800">Subtotal</span>
          <span className="font-semibold text-slate-800">{subtotal}</span>
        </div>
        {cart.items.length === 0 ? (
          <Link
            href="/dashboard/home"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Continue Shopping
          </Link>
        ) : (
          <Link
            href="/dashboard/checkout"
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2952cc]"
          >
            Proceed to Checkout
          </Link>
        )}
      </div>
    </Card>
  );
}
