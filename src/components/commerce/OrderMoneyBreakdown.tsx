import { pricingMoney, type OrderPricing } from "./orderPricing";

export default function OrderMoneyBreakdown({ pricing, seller = false }: { pricing: OrderPricing; seller?: boolean }) {
  const productAmount = pricing.buyerTotal !== null && pricing.deliveryFee !== null
    ? (Math.round(pricing.buyerTotal * 100) - Math.round(pricing.deliveryFee * 100)) / 100
    : pricing.productSubtotal !== null && pricing.adminCommission !== null
      ? (Math.round(pricing.productSubtotal * 100) + Math.round(pricing.adminCommission * 100)) / 100 : null;
  const entries: Array<[string, number | null]> = seller
    ? [["Product subtotal", pricing.productSubtotal], ["Admin commission" + (pricing.commissionPercentage === null ? "" : " (" + pricing.commissionPercentage + "%)"), pricing.adminCommission], ["Delivery fee", pricing.deliveryFee], ["Buyer total", pricing.buyerTotal], ["Seller proceeds", pricing.sellerProceeds]]
    : pricing.requiresDelivery === false
      ? [["Total amount", pricing.buyerTotal]]
      : [["Total amount", productAmount], ["Delivery fee", pricing.deliveryFee], ["Total", pricing.buyerTotal]];
  return <div className="mt-4 text-sm" aria-label={seller ? "Seller order pricing" : "Buyer order pricing"}>
    <dl className="grid gap-3">{entries.map(([label, value]) => <div className="flex flex-wrap justify-between gap-2" key={label}><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-800">{pricingMoney(value)}</dd></div>)}</dl>
    {seller ? <p className="mt-3 text-xs leading-relaxed text-slate-500">Seller proceeds equal the product subtotal. Admin commission and delivery fees are added to the buyer total. Proceeds may remain in escrow until funds are released.</p> : null}
    {pricing.issues.length ? <p role="alert" className="mt-3 text-sm text-rose-700">{seller ? pricing.issues.join(" ") : "Order pricing could not be confirmed. Please refresh the order pricing."}</p> : null}
  </div>;
}
