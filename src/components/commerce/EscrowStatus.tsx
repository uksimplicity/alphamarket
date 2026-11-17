import { escrowDescription } from "./escrow";
import { pricingMoney } from "./orderPricing";

export default function EscrowStatus({ status, sellerAmount }: { status: string; sellerAmount?: number | null }) {
  return <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-4" aria-label="Escrow status">
    <p className="text-sm font-semibold text-slate-800">Escrow: <span className="capitalize">{status === "unknown" ? "Not reported" : status.replaceAll("_", " ")}</span></p>
    {["held", "funded", "locked", "in_escrow"].includes(status) && sellerAmount !== undefined ? <p className="mt-2 text-sm text-slate-700">Seller proceeds held: <strong className="text-slate-900">{pricingMoney(sellerAmount)}</strong></p> : null}
    <p className="mt-1 text-xs leading-relaxed text-slate-600">{escrowDescription(status)}</p>
  </section>;
}
