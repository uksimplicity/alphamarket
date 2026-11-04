"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { checkAccount } from "@/components/commerce/localAccountData";
import { formatCurrency } from "@/components/commerce/store";
import type { ChatClient } from "./chatClient";
import styles from "./chat.module.css";

type ProductSummary = { id: string; title: string; image: string; price: number | null };

export default function ConversationProduct({ client, productId }: { client: ChatClient; productId: string }) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ id: string; product: ProductSummary | null; loading: boolean; error: string }>({ id: "", product: null, loading: false, error: "" });
  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    setState({ id: productId, product: null, loading: true, error: "" });
    void (async () => {
      try {
        checkAccount(client.stamp);
        const response = await fetch("/api/products/public/" + encodeURIComponent(productId), { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        checkAccount(client.stamp);
        if (controller.signal.aborted) return;
        if (response.status === 404) { setState({ id: productId, product: null, loading: false, error: "This product is no longer available." }); return; }
        if (!response.ok) throw new Error();
        const data = (await response.json()).data;
        checkAccount(client.stamp);
        if (!data || data.id !== productId || data.preview || typeof data.title !== "string" || !data.title.trim()) throw new Error();
        const rawPrice = data.price;
        const price = (typeof rawPrice === "string" && rawPrice.trim() || typeof rawPrice === "number") && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0 ? Number(rawPrice) : null;
        const image = typeof data.image === "string" && /^(?:https?:\/\/|\/(?!\/))/.test(data.image) ? data.image : "";
        if (!controller.signal.aborted) setState({ id: productId, product: { id: data.id, title: data.title.trim(), image, price }, loading: false, error: "" });
      } catch { if (!controller.signal.aborted) setState({ id: productId, product: null, loading: false, error: "Product details could not be loaded." }); }
    })();
    return () => controller.abort();
  }, [client, productId, revision]);

  const current = state.id === productId ? state : null;
  const product = current?.product;
  return <aside className={styles.productContext} aria-label="Product discussed">
    {product ? <>
      {product.image ? <img src={product.image} alt="" className={styles.productImage} onError={event => { event.currentTarget.hidden = true; }} /> : null}
      <div className={styles.productInfo}><span>About this product</span><Link href={"/products/" + encodeURIComponent(product.id)}>{product.title}</Link>{product.price !== null ? <strong>{formatCurrency(product.price)}</strong> : null}</div>
      <Link className={styles.productLink} href={"/products/" + encodeURIComponent(product.id)}>View product</Link>
    </> : <div className={styles.productInfo}><span>About this product</span><p role="status">{!productId ? "No product reference was provided for this conversation." : !current || current.loading ? "Loading product details..." : current.error}</p>{current?.error === "Product details could not be loaded." ? <button type="button" onClick={() => setRevision(value => value + 1)}>Retry product details</button> : null}</div>}
  </aside>;
}
