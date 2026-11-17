export type AdminWallet = { id: string; owner: string; type: string; balance: string | null; currency: string; status: string };

export function parseAdminWallets(payload: unknown): AdminWallet[] {
  const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  let value = payload;
  for (let depth = 0; depth < 6; depth++) {
    if (Array.isArray(value)) return value.map(item => {
      const row = record(item);
      const text = (...values: unknown[]) => values.find(value => typeof value === "string" && value.trim()) as string | undefined;
      const id = text(row.id, row.wallet_id)?.trim();
      if (!id) throw new Error("A wallet record could not be read. Refresh the wallet list.");
      const balance = row.balance ?? row.available_balance;
      const readableBalance = (typeof balance === "string" || typeof balance === "number") && String(balance).trim() !== "" && Number.isFinite(Number(balance));
      return { id, owner: text(row.user_id, row.owner_id)?.trim() || "", type: text(row.wallet_type)?.trim() || "Not reported",
        balance: readableBalance ? String(balance).trim() : null, currency: text(row.currency)?.trim() || "",
        status: typeof row.is_active === "boolean" ? row.is_active ? "Active" : "Inactive" : text(row.status)?.trim() || "Not reported" };
    });
    const row = record(value);
    if (row.success === false) throw new Error(typeof row.error === "string" ? row.error : "Wallets could not be loaded.");
    const nested = row.data ?? row.wallets ?? row.items ?? row.rows;
    if (nested == null) break;
    value = nested;
  }
  throw new Error("The wallet list could not be read. Refresh to try again.");
}

export function walletBalance(wallet: Pick<AdminWallet, "balance" | "currency">) {
  if (wallet.balance === null) return "Not reported";
  if (wallet.currency) {
    try { return new Intl.NumberFormat("en-NG", { style: "currency", currency: wallet.currency, currencyDisplay: "code" }).format(Number(wallet.balance)); }
    catch { return `${wallet.currency} ${wallet.balance}`; }
  }
  return `${wallet.balance} (currency not reported)`;
}
