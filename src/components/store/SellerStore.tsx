"use client";

import { useSyncExternalStore } from "react";
import { extendedCatalog } from "@/components/products/catalog";
import { formatCurrency, parsePrice } from "@/components/commerce/store";
import { Card, SectionTitle } from "@/components/dashboard/ui";
import {
  getStoreProfileBySlug,
  subscribeStoreProfiles,
  type SellerStoreProfile,
} from "@/components/store/storeProfileClient";

export default function SellerStore({
  sellerSlug,
}: {
  sellerSlug: string;
}) {
  const products = extendedCatalog.filter(
    (item) => item.seller.slug === sellerSlug
  );
  const storeProfile = useSyncExternalStore(
    subscribeStoreProfiles,
    () => getStoreProfileBySlug(sellerSlug),
    () => null
  ) as SellerStoreProfile | null;

  const sellerName = storeProfile?.name || products[0]?.seller.name || "Seller";
  const subtitle = `${products.length} item${products.length === 1 ? "" : "s"}`;
  const location = storeProfile?.location?.trim() ?? "";
  const description = storeProfile?.description?.trim() ?? "";
  const logo =
    storeProfile?.logoFallbackDataUrl?.trim() || storeProfile?.logoUrl?.trim() || "";

  return (
    <div className="w-full px-6 pb-10 pt-6">
      <div className="mb-6">
        <SectionTitle title={`${sellerName} Store`} subtitle={subtitle} />
        {(location || description || logo) ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {logo ? (
                  <img
                    src={logo}
                    alt={`${sellerName} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-base font-semibold text-slate-600">
                    {sellerName.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="grid gap-1 text-sm text-slate-600">
                {location ? <div>{location}</div> : null}
                {description ? <div>{description}</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {products.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">
            No products found for this seller yet.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {products.map((item) => (
            <a key={item.id} href={`/products/${item.id}`}>
              <Card>
                <div className="overflow-hidden rounded-xl bg-slate-50">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-40 w-full object-cover"
                  />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-800">
                  {item.title}
                </div>
                <div className="text-sm text-slate-500">
                  {formatCurrency(parsePrice(item.price))}
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
