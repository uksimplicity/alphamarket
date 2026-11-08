import { pricingMoney, type OrderPricing } from "./orderPricing";

export default function OrderMoneyBreakdown({ pricing, seller = false }: { pricing: OrderPricing; seller?: boolean }) {
  const entries: Array<[string, number | null]> = [["Product subtotal", pricing.productSubtotal], ["Delivery fee", pricing.deliveryFee], [seller ? "Buyer total" : "Total", pricing.buyerTotal]];
  if (seller) entries.push(["Admin commission" + (pricing.commissionPercentage === null ? "" : " (" + pricing.commissionPercentage + "%)"), pricing.adminCommission], ["Seller proceeds", pricing.sellerProceeds]);
  return <div className="mt-4 text-sm" aria-label={seller ? "Seller order pricing" : "Buyer order pricing"}>
    <dl className="grid gap-3">{entries.map(([label, value]) => <div className="flex flex-wrap justify-between gap-2" key={label}><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-800">{pricingMoney(value)}</dd></div>)}</dl>
    {seller ? <p className="mt-3 text-xs leading-relaxed text-slate-500">Seller proceeds are the product subtotal minus admin commission. Delivery fees are separate. Proceeds may remain in escrow until funds are released.</p> : null}
    {pricing.issues.length ? <p role="alert" className="mt-3 text-sm text-rose-700">{pricing.issues.join(" ")}</p> : null}
  </div>;
}
