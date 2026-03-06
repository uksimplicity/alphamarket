"use client";

import { Link, useParams } from "react-router-dom";
import SellerStore from "@/components/store/SellerStore";
import MarketplaceHeaderRouter from "@/components/marketplace/MarketplaceHeaderRouter";
import MarketplaceFooterRouter from "@/components/marketplace/MarketplaceFooterRouter";

export default function SellerStoreRoute() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <>
      <MarketplaceHeaderRouter />
      <SellerStore sellerSlug={slug ?? ""} />
      <MarketplaceFooterRouter />
    </>
  );
}
