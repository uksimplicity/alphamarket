"use client";
import Link from "next/link";
import { money } from "./data";
import type { PostingCost } from "./client";
import styles from "./ads.module.css";

export default function PostingFee({ categoryId, cost, loading, error, refresh, walletHref }: {
  categoryId: string; cost?: PostingCost; loading: boolean; error?: string; refresh: () => void; walletHref: string;
}) {
  const insufficient = cost && cost.fee > 0 && (cost.balance === null || cost.balance < cost.fee);
  return <section className={styles.notice} aria-label="Posting fee and wallet">
    <h3>Posting fee</h3>
    {!categoryId ? <p>Select a category to check the posting fee.</p> : loading ? <p role="status">Checking posting fee and wallet…</p> : error ? <p role="alert">{error}</p> : cost ? <>
      <p>Posting fee: <strong>{cost.fee === 0 ? "Free" : money(cost.fee)}</strong> · Wallet balance: <strong>{money(cost.balance)}</strong></p>
      <p>{cost.fee > 0 ? "The fee is deducted from your wallet when you submit. It is refunded if an administrator rejects the ad." : "No posting fee applies to this category."}</p>
      {insufficient ? <p role="alert">{cost.balance === null ? "Your wallet balance could not be verified." : "Your wallet balance is too low for this posting fee."} <Link href={walletHref}>Fund Wallet</Link></p> : null}
    </> : null}
    {categoryId ? <button type="button" disabled={loading} onClick={refresh}>Refresh fee and balance</button> : null}
  </section>;
}
