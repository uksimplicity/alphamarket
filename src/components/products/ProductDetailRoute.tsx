"use client";

import { Link, useParams } from "react-router-dom";
import { ErrorState } from "@/components/dashboard/ui";
import MarketplaceFooterRouter from "@/components/marketplace/MarketplaceFooterRouter";
import MarketplaceHeaderRouter from "@/components/marketplace/MarketplaceHeaderRouter";
import { getProductById } from "@/components/products/catalog";
import ProductDetail from "@/components/products/ProductDetail";

export default function ProductDetailRoute() {
  const { productId } = useParams<{ productId: string }>();
  const product = productId ? getProductById(productId) : undefined;

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
