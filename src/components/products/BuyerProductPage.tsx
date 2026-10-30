"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ProductDetail from "./ProductDetail";
import { getProductById, type Product } from "./catalog";
import { buyerProducts } from "@/components/dashboard/buyerCatalog";
import MarketplaceHeaderNext from "@/components/marketplace/MarketplaceHeaderNext";
import MarketplaceFooterNext from "@/components/marketplace/MarketplaceFooterNext";
import styles from "./productDetail.module.css";

export default function BuyerProductPage({ id }: { id: string }) {
  const example = getProductById(id);
  const [live, setLive] = useState<{ id: string; product: Product | null }>({ id: "", product: null });
  const [loading, setLoading] = useState(!example);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (example) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    void (async () => {
      try {
        const response = await fetch("/api/products/public?limit=100&offset=0", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("This product couldn't be loaded. Please try again.");
        const found = buyerProducts(await response.json()).find(product => product.id === id) ?? null;
        if (!controller.signal.aborted) setLive({ id, product: found });
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "This product couldn't be loaded."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [id, !!example, revision]);
  const product = example ?? (live.id === id ? live.product : null);
  return <div className={styles.surface}><div style={{ maxWidth: 1270, margin: "0 auto", padding: "0 20px" }}><MarketplaceHeaderNext /></div>{product ? <ProductDetail key={id} product={product} backLink={<Link href="/dashboard/home">Back to your marketplace</Link>} /> : <main className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold text-slate-700">{loading ? "Finding your good find..." : "This product isn't available."}</h1>{error ? <p className="mt-4 text-sm text-slate-500" role="alert">{error}</p> : null}{!loading ? <div className="mt-6 flex justify-center gap-5 text-sm text-blue-600"><button onClick={() => setRevision(value => value + 1)}>Try again</button><Link href="/dashboard/home#buyer-finds">Explore the marketplace</Link></div> : null}</main>}<MarketplaceFooterNext /></div>;
}
