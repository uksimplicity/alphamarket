"use client";

import MarketplaceFooterNext from "@/components/marketplace/MarketplaceFooterNext";
import MarketplaceHeaderNext from "@/components/marketplace/MarketplaceHeaderNext";

export default function StorePageClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketplaceHeaderNext />
      {children}
      <MarketplaceFooterNext />
    </>
  );
}
