import { escrowDescription } from "./escrow";

export default function EscrowStatus({ status }: { status: string }) {
  return <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-4" aria-label="Escrow status">
    <p className="text-sm font-semibold text-slate-800">Escrow: <span className="capitalize">{status === "unknown" ? "Not reported" : status.replaceAll("_", " ")}</span></p>
    <p className="mt-1 text-xs leading-relaxed text-slate-600">{escrowDescription(status)}</p>
  </section>;
}
