"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorState } from "@/components/dashboard/ui";
import MarketplaceFooterRouter from "@/components/marketplace/MarketplaceFooterRouter";
import MarketplaceHeaderRouter from "@/components/marketplace/MarketplaceHeaderRouter";
import { getAuth } from "@/components/auth/authStorage";
import { getProductById, type Product } from "@/components/products/catalog";
import ProductDetail from "@/components/products/ProductDetail";

function mapLiveProduct(record: Record<string, unknown>, fallbackId: string): Product {
  const media =
    record.media && typeof record.media === "object"
      ? (record.media as Record<string, unknown>)
      : null;
  const images = Array.isArray(media?.images) ? media?.images : [];
  const image = String(
    media?.cover ??
      media?.coverUrl ??
      images[0] ??
      record.cover ??
      record.image ??
      "https://images.unsplash.com/photo-1557821552-17105176677c?auto=format&fit=crop&w=900&q=80"
  );
  const amount = Number(record.basePrice ?? record.base_price ?? record.price ?? 0);

  return {
    id: String(record.id ?? record.product_id ?? record.uuid ?? fallbackId),
    title: String(record.name ?? record.title ?? "Product"),
    price: `₦${Number.isFinite(amount) ? amount.toLocaleString() : "0"}`,
    oldPrice: undefined,
    badge: undefined,
    image,
    rating: "4.5",
    reviews: "0",
    description: String(record.shortDescription ?? record.description ?? "No description available."),
    seller: {
      name: "Marketplace Seller",
      slug: "marketplace-seller",
    },
  };
}

export default function ProductDetailRoute() {
  const { productId } = useParams<{ productId: string }>();
  const staticProduct = productId ? getProductById(productId) : undefined;
  const [liveProduct, setLiveProduct] = useState<Product | null>(null);
  const [localProduct, setLocalProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId || staticProduct) return;
    try {
      const raw = localStorage.getItem("alpha.createdProducts");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const found = parsed.find((row) => {
        if (!row || typeof row !== "object") return false;
        const id = String((row as Record<string, unknown>).id ?? "");
        return id === productId;
      });
      if (!found || typeof found !== "object") return;
      setLocalProduct(mapLiveProduct(found as Record<string, unknown>, productId));
    } catch {
      // ignore local parse issues
    }
  }, [productId, staticProduct]);

  useEffect(() => {
    if (!productId || staticProduct) return;
    let mounted = true;

    async function loadLiveProduct() {
      setLoading(true);
      try {
        const auth = getAuth();
        const token = auth?.access_token;
        const response = await fetch(`/api/seller/products/${encodeURIComponent(productId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const payload = await response.json();
        const record =
          payload && typeof payload === "object"
            ? ((payload.data ?? payload.product ?? payload.item ?? payload) as Record<string, unknown>)
            : null;
        if (!record || !mounted) return;
        setLiveProduct(mapLiveProduct(record, productId));
      } catch {
        // keep not found state
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadLiveProduct();
    return () => {
      mounted = false;
    };
  }, [productId, staticProduct]);

  const product = useMemo(
    () => staticProduct ?? localProduct ?? liveProduct ?? undefined,
    [liveProduct, localProduct, staticProduct]
  );

  if (!product && loading) {
    return (
      <>
        <MarketplaceHeaderRouter />
        <div className="w-full px-6 pb-10 pt-6">
          <div className="text-sm text-slate-500">Loading product...</div>
        </div>
        <MarketplaceFooterRouter />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <MarketplaceHeaderRouter />
        <div className="w-full px-6 pb-10 pt-6">
          <ErrorState message="Product not found." />
          <div className="mt-4">
            <Link to="/" className="text-sm font-semibold text-brand">
              Back to home
            </Link>
          </div>
        </div>
        <MarketplaceFooterRouter />
      </>
    );
  }

  return (
    <>
      <MarketplaceHeaderRouter />
      <div className="w-full px-6 pb-10 pt-6">
        <ProductDetail
          product={product}
          backLink={
            <Link to="/" className="text-sm font-semibold text-brand">
              Back to home
            </Link>
          }
        />
      </div>
      <MarketplaceFooterRouter />
    </>
  );
}
