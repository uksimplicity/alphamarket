type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
export type OrderPricing = {
  productSubtotal: number | null; deliveryFee: number | null; buyerTotal: number | null;
  commissionPercentage: number | null; adminCommission: number | null; sellerProceeds: number | null;
  issues: string[];
  requiresDelivery?: boolean;
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
export function orderPricing(payload: unknown, fallback?: unknown): OrderPricing {
  const envelope = row(payload), data = row(envelope.data ?? payload), order = row(data.order ?? data);
  const source = { ...order, ...row(order.pricing) }, issues: string[] = [];
  const saved = row(fallback), savedSource = { ...saved, ...row(saved.pricing) };
  const read = (keys: string[]) => first(source, keys) ?? first(savedSource, keys);
  function moneyValue(raw: unknown) {
    const value = kobo(raw);
    if (raw !== undefined && value === null) issues.push("An order amount is invalid.");
    return value;
  }
  const money = (keys: string[]) => moneyValue(read(keys));
  let subtotal = money(["product_subtotal", "items_subtotal", "subtotal", "subtotal_amount"]);
  const deliveryRequired = read(["requires_delivery", "requiresDelivery", "RequiresDelivery"]);
  if (deliveryRequired !== undefined && typeof deliveryRequired !== "boolean") issues.push("The order delivery selection is invalid.");
  const deliveryKeys = ["delivery_fee", "deliveryFee", "DeliveryFee", "shipping_fee"];
  let delivery = money(deliveryKeys);
  if (deliveryRequired === false) delivery = 0;
  const totalKeys = ["buyer_total", "total_amount", "totalAmount", "total", "amount"];
  const totalSource = first(source, [...totalKeys, "TotalAmount"]) === undefined ? savedSource : source;
  const allInTotal = first(totalSource, totalKeys);
  let total = moneyValue(allInTotal);
  // Create Order's TotalAmount includes products + commission, excluding DeliveryFee.
  // Explicit buyer_total / total_amount fields retain their all-in semantics.
  const productTotal = allInTotal === undefined ? moneyValue(first(totalSource, ["TotalAmount"])) : null;
  if (productTotal !== null && delivery !== null) {
    if (Number.isSafeInteger(productTotal + delivery)) total = productTotal + delivery;
    else issues.push("The calculated buyer total is invalid.");
  }
  let commission = money(["admin_commission", "commission_amount", "commission_amt", "platform_commission_amount", "Commission"]);
  let seller = money(["seller_proceeds", "seller_net_amount", "seller_payout_amount"]);
  const percentageRaw = read(["commission_percentage"]);
  const percentage = (typeof percentageRaw === "number" || typeof percentageRaw === "string" && percentageRaw.trim()) && Number.isFinite(Number(percentageRaw)) && Number(percentageRaw) >= 0 && Number(percentageRaw) <= 100 ? Number(percentageRaw) : null;
  if (percentageRaw !== undefined && percentage === null) issues.push("The order commission percentage is invalid.");
  const items = order.items ?? order.order_items ?? order.Items ?? saved.items ?? saved.order_items ?? saved.Items;
  if (subtotal === null && Array.isArray(items) && items.length) {
    const amounts = items.map(input => { const item = row(input), unit = kobo(item.unit_price ?? item.unitPrice ?? item.price), quantity = Number(item.quantity ?? item.qty); return unit !== null && Number.isSafeInteger(quantity) && quantity > 0 && Number.isSafeInteger(unit * quantity) ? unit * quantity : null; });
    if (amounts.every((value): value is number => value !== null)) {
      const sum = amounts.reduce((sum, value) => sum + value, 0);
      if (Number.isSafeInteger(sum)) subtotal = sum;
    }
  }
  // Commission is an additional buyer charge. Never mistake it for delivery
  // or subtract it from the seller's price. Unknown commission stays unknown.
  if (subtotal === null && productTotal !== null && commission !== null) {
    if (productTotal >= commission) subtotal = productTotal - commission;
    else issues.push("The commission exceeds the product total.");
  }
  if (subtotal === null && total !== null && delivery !== null && commission !== null && total >= delivery + commission) subtotal = total - delivery - commission;
  if (commission === null && subtotal !== null && percentage !== null) commission = Math.round(subtotal * percentage / 100);
  if (subtotal !== null && percentage !== null && commission !== null && Math.abs(commission - Math.round(subtotal * percentage / 100)) > 1) issues.push("The commission amount does not match the order's recorded percentage.");
  if (subtotal !== null && total !== null) {
    if (total < subtotal) issues.push("The buyer total is less than the product subtotal.");
    if (commission !== null && deliveryRequired !== false && read(deliveryKeys) === undefined) {
      if (total >= subtotal + commission) delivery = total - subtotal - commission;
      else issues.push("The buyer total is less than the product subtotal plus admin commission.");
    }
  }
  if (total !== null && delivery !== null && delivery > total) issues.push("The delivery fee exceeds the buyer total.");
  if (subtotal !== null && delivery !== null && commission !== null) {
    const expected = subtotal + commission + delivery;
    if (Number.isSafeInteger(expected)) {
      if (total === null) total = expected;
      else if (total !== expected) issues.push("The buyer total does not match the product subtotal plus admin commission plus delivery.");
    } else issues.push("The calculated buyer total is invalid.");
  }
  if (subtotal !== null) {
    if (seller === null) seller = subtotal;
    else if (seller !== subtotal) { issues.push("Seller proceeds do not match the product subtotal."); seller = null; }
  }
  const naira = (value: number | null) => value === null ? null : value / 100;
  return { productSubtotal: naira(subtotal), deliveryFee: naira(delivery), buyerTotal: naira(total), commissionPercentage: percentage, adminCommission: naira(commission), sellerProceeds: naira(seller), issues: [...new Set(issues)], ...(typeof deliveryRequired === "boolean" ? { requiresDelivery: deliveryRequired } : {}) };
}
export function pricingTotal(values: OrderPricing[]): OrderPricing {
  const sum = (key: "productSubtotal" | "deliveryFee" | "buyerTotal" | "adminCommission" | "sellerProceeds") => {
    const amounts = values.map(value => value[key]);
    if (!amounts.length || amounts.some(value => value === null)) return null;
    const cents = amounts.reduce<number>((total, value) => total + Math.round(value! * 100), 0);
    return Number.isSafeInteger(cents) ? cents / 100 : null;
  };
  const requiresDelivery = values.some(value => value.requiresDelivery === true) ? true : values.length && values.every(value => value.requiresDelivery === false) ? false : undefined;
  return { productSubtotal: sum("productSubtotal"), deliveryFee: sum("deliveryFee"), buyerTotal: sum("buyerTotal"), commissionPercentage: null, adminCommission: sum("adminCommission"), sellerProceeds: sum("sellerProceeds"), issues: [...new Set(values.flatMap(value => value.issues))], ...(requiresDelivery === undefined ? {} : { requiresDelivery }) };
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
  const resolved = { ...pricing, productSubtotal: subtotal };
  const difference = Math.round(pricing.buyerTotal * 100) - Math.round(subtotal * 100);
  if (difference < 0) return { ...resolved, issues: ["The buyer total is less than the product subtotal."] };
  if (pricing.adminCommission === null) return resolved;
  const delivery = difference - Math.round(pricing.adminCommission * 100);
  if (delivery < 0) return { ...resolved, issues: ["The buyer total is less than the product subtotal plus admin commission."] };
  return { ...resolved, deliveryFee: delivery / 100 };
}
export const pricingMoney = (value: number | null) => value === null ? "Not reported" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
