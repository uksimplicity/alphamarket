"use client";
import Link from "next/link";
import { useState } from "react";
import { useAdsResource } from "./hooks";
import { amount, date, label, money, text } from "./data";
import { collection, Feedback, Pager } from "./Common";
import styles from "./ads.module.css";

export default function WalletPage({ adsHref }: { adsHref: string }) {
  const [offset, setOffset] = useState(0);
  const wallet = useAdsResource("/api/wallet/balance"), transactions = useAdsResource(`/api/wallet/transactions?limit=20&offset=${offset}`), list = collection(transactions.data);
  return <div className={styles.page}><header className={styles.header}><div><h1>Wallet</h1><p className={styles.muted}>Your balance pays for ad posting fees and promotions.</p></div><Link className={styles.button} href={adsHref}>My Ads</Link></header><section className={styles.card}><h2>Available balance</h2><Feedback error={wallet.error} /><p className={styles.price}>{wallet.loading ? "Loading…" : money(amount(wallet.data, ["balance", "available_balance", "wallet_balance", "wallet"]))}</p><button onClick={() => { wallet.refresh(); transactions.refresh(); }}>Refresh wallet</button><div className={styles.notice}><h3>Fund Wallet with Paystack</h3><p>Wallet top-up is not available yet. Please try again later or contact support.</p><button disabled>Fund Wallet with Paystack</button></div></section><section className={styles.card}><h2>Wallet transactions</h2><Feedback error={transactions.error || list.error} />{transactions.loading ? <p>Loading transactions…</p> : list.items.length ? <div className={styles.table}><table><thead><tr><th>Transaction</th><th>Type</th><th>Amount</th><th>Date</th></tr></thead><tbody>{list.items.map((item, index) => <tr key={text(item.id, String(index))}><td>{text(item.description ?? item.reference)}</td><td>{label(item.type ?? item.transaction_type)}</td><td>{money(item.amount)}</td><td>{date(item.created_at)}</td></tr>)}</tbody></table></div> : !transactions.error && !list.error ? <p className={styles.empty}>No transactions yet.</p> : null}<Pager offset={offset} count={list.items.length} total={list.total} onPage={setOffset} /></section></div>;
}
