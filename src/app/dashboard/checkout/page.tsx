"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cartSubtotal,
  createOrder,
  formatCurrency,
  updateCartQty,
  useCart,
} from "@/components/commerce/store";
import { Button, Card, SectionTitle } from "@/components/dashboard/ui";

type CheckoutForm = {
  name: string;
  phone: string;
  address: string;
  payment: "card" | "transfer" | "pay_on_delivery";
};

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const [form, setForm] = useState<CheckoutForm>({
    name: "",
    phone: "",
    address: "",
    payment: "card",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const subtotal = formatCurrency(cartSubtotal(cart));

  const onChange = (field: keyof CheckoutForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (cart.items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Please complete your name, phone, and delivery address.");
      return;
    }

    setSubmitting(true);
    try {
      const order = createOrder({
        address: `${form.name}, ${form.phone}, ${form.address}`,
      });
      router.push(`/dashboard/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <SectionTitle title="Checkout" subtitle="Confirm delivery details." />
        <form className="mt-6 space-y-4 text-sm" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-600">
              {error}
            </div>
          ) : null}
          <div className="grid gap-3">
            <label className="text-xs font-semibold text-slate-600">Full name</label>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={form.name}
              onChange={(event) => onChange("name", event.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="grid gap-3">
            <label className="text-xs font-semibold text-slate-600">Phone number</label>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={form.phone}
              onChange={(event) => onChange("phone", event.target.value)}
              placeholder="0801 234 5678"
            />
          </div>
          <div className="grid gap-3">
            <label className="text-xs font-semibold text-slate-600">Delivery address</label>
            <textarea
              className="min-h-[120px] rounded-xl border border-slate-200 px-3 py-2"
              value={form.address}
              onChange={(event) => onChange("address", event.target.value)}
              placeholder="Street, city, state"
            />
          </div>
          <div className="grid gap-3">
            <label className="text-xs font-semibold text-slate-600">Payment method</label>
            <div className="grid gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment"
                  checked={form.payment === "card"}
                  onChange={() => onChange("payment", "card")}
                />
                Pay with card
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment"
                  checked={form.payment === "transfer"}
                  onChange={() => onChange("payment", "transfer")}
                />
                Bank transfer
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment"
                  checked={form.payment === "pay_on_delivery"}
                  onChange={() => onChange("payment", "pay_on_delivery")}
                />
                Pay on delivery
              </label>
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Placing order..." : "Place Order"}
          </Button>
          <Link
            href="/dashboard/cart"
            className="ml-3 inline-flex items-center text-sm font-semibold text-slate-500"
          >
            Back to cart
          </Link>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Order Summary" subtitle="Review your items." />
        <div className="mt-4 space-y-4 text-sm">
          {cart.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
              No items yet. Add products to your cart.
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
                  <div className="font-semibold text-slate-800">
                    {formatCurrency(item.price * item.qty)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
            <span className="font-semibold text-slate-800">Subtotal</span>
            <span className="font-semibold text-slate-800">{subtotal}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
