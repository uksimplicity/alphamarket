type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
export type OrderPricing = {
  productSubtotal: number | null; deliveryFee: number | null; buyerTotal: number | null;
  commissionPercentage: number | null; adminCommission: number | null; sellerProceeds: number | null;
  issues: string[];
};

// Backend money is in naira. Missing values remain unknown; arithmetic uses kobo.
function kobo(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string" || typeof value === "string" && !value.trim()) return null;
  const amount = Number(value), cents = Math.round(amount * 100);
  return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(cents) && Math.abs(amount * 100 - cents) < 0.000001 ? cents : null;
}
function first(source: Row, keys: string[]) {
  for (const key of keys) if (source[key] !== null && source[key] !== undefined) return source[key];
  return undefined;
}
export function orderPricing(payload: unknown): OrderPricing {
  const envelope = row(payload), data = row(envelope.data ?? payload), order = row(data.order ?? data);
  const source = { ...order, ...row(order.pricing) }, issues: string[] = [];
  function money(keys: string[]) {
    const raw = first(source, keys), value = kobo(raw);
    if (raw !== undefined && value === null) issues.push("An order amount is invalid.");
    return value;
  }
  let subtotal = money(["product_subtotal", "items_subtotal", "subtotal", "subtotal_amount"]);
  const deliveryKeys = ["delivery_fee", "deliveryFee", "shipping_fee"];
  let delivery = money(deliveryKeys);
  let total = money(["buyer_total", "total_amount", "totalAmount", "TotalAmount", "total", "amount"]);
  let commission = money(["admin_commission", "commission_amount", "commission_amt", "platform_commission_amount"]);
  let seller = money(["seller_proceeds", "seller_net_amount", "seller_payout_amount"]);
  const percentageRaw = first(source, ["commission_percentage"]);
  const percentage = (typeof percentageRaw === "number" || typeof percentageRaw === "string" && percentageRaw.trim()) && Number.isFinite(Number(percentageRaw)) && Number(percentageRaw) >= 0 && Number(percentageRaw) <= 100 ? Number(percentageRaw) : null;
  if (percentageRaw !== undefined && percentage === null) issues.push("The order commission percentage is invalid.");
  const items = order.items ?? order.order_items;
  if (subtotal === null && Array.isArray(items) && items.length) {
    const amounts = items.map(input => { const item = row(input), unit = kobo(item.unit_price ?? item.unitPrice ?? item.price), quantity = Number(item.quantity ?? item.qty); return unit !== null && Number.isSafeInteger(quantity) && quantity > 0 && Number.isSafeInteger(unit * quantity) ? unit * quantity : null; });
    if (amounts.every((value): value is number => value !== null)) {
      const sum = amounts.reduce((sum, value) => sum + value, 0);
      if (Number.isSafeInteger(sum)) subtotal = sum;
    }
  }
  if (subtotal === null && total !== null && delivery !== null && total >= delivery) subtotal = total - delivery;
  // Until the backend exposes a separate fee, display the difference requested
  // by the marketplace: buyer total minus the seller's product subtotal.
  if (first(source, deliveryKeys) === undefined && subtotal !== null && total !== null) {
    if (total >= subtotal) delivery = total - subtotal;
    else issues.push("The buyer total is less than the product subtotal.");
  }
  if (total !== null && delivery !== null && delivery > total) issues.push("The delivery fee exceeds the buyer total.");
  if (total === null && subtotal !== null && delivery !== null && Number.isSafeInteger(subtotal + delivery)) total = subtotal + delivery;
  if (subtotal !== null && delivery !== null && total !== null && subtotal + delivery !== total) issues.push("The buyer total does not match the product subtotal plus delivery.");
  if (commission === null && subtotal !== null && percentage !== null) commission = Math.round(subtotal * percentage / 100);
  if (subtotal !== null && percentage !== null && commission !== null && Math.abs(commission - Math.round(subtotal * percentage / 100)) > 1) issues.push("The commission amount does not match the order's recorded percentage.");
  if (subtotal !== null && commission !== null) {
    if (commission > subtotal) { issues.push("Commission exceeds the product subtotal."); seller = null; }
    else if (seller === null) seller = subtotal - commission;
    else if (seller !== subtotal - commission) { issues.push("Seller proceeds do not match the product subtotal minus commission."); seller = null; }
  }
  if (subtotal !== null && seller !== null && seller > subtotal) { issues.push("Seller proceeds exceed the product subtotal."); seller = null; }
  const naira = (value: number | null) => value === null ? null : value / 100;
  return { productSubtotal: naira(subtotal), deliveryFee: naira(delivery), buyerTotal: naira(total), commissionPercentage: percentage, adminCommission: naira(commission), sellerProceeds: naira(seller), issues: [...new Set(issues)] };
}
export function pricingTotal(values: OrderPricing[]): OrderPricing {
  const sum = (key: "productSubtotal" | "deliveryFee" | "buyerTotal" | "adminCommission" | "sellerProceeds") => {
    const amounts = values.map(value => value[key]);
    if (!amounts.length || amounts.some(value => value === null)) return null;
    const cents = amounts.reduce<number>((total, value) => total + Math.round(value! * 100), 0);
    return Number.isSafeInteger(cents) ? cents / 100 : null;
  };
  return { productSubtotal: sum("productSubtotal"), deliveryFee: sum("deliveryFee"), buyerTotal: sum("buyerTotal"), commissionPercentage: null, adminCommission: sum("adminCommission"), sellerProceeds: sum("sellerProceeds"), issues: [...new Set(values.flatMap(value => value.issues))] };
}

// The cart snapshot belongs to the submitted checkout, not the current cart or
// today's catalogue. Aggregate once across all seller orders; never apply the
// entire cart subtotal separately to each order.
export function checkoutPricing(values: OrderPricing[], cartKey?: string): OrderPricing {
  const pricing = pricingTotal(values);
  if (pricing.deliveryFee !== null || pricing.buyerTotal === null || pricing.issues.length) return pricing;
  let subtotal = pricing.productSubtotal;
  if (subtotal === null && cartKey) {
    try {
      const items = JSON.parse(cartKey);
      if (!Array.isArray(items) || !items.length) return pricing;
      let cents = 0;
      for (const input of items) {
        const item = row(input), price = kobo(item.price), quantity = item.qty;
        if (typeof item.id !== "string" || !item.id.trim() || price === null || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(price * quantity)) return pricing;
        cents += price * quantity;
        if (!Number.isSafeInteger(cents)) return pricing;
      }
      subtotal = cents / 100;
    } catch { return pricing; }
  }
  if (subtotal === null) return pricing;
  const difference = Math.round(pricing.buyerTotal * 100) - Math.round(subtotal * 100);
  if (difference < 0) return { ...pricing, productSubtotal: subtotal, issues: ["The buyer total is less than the product subtotal."] };
  return { ...pricing, productSubtotal: subtotal, deliveryFee: difference / 100 };
}
export const pricingMoney = (value: number | null) => value === null ? "Not reported" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
