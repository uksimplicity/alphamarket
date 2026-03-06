"use client";

import Link from "next/link";
import { extendedCatalog, type Product } from "@/components/products/catalog";
import { formatCurrency, parsePrice } from "@/components/commerce/store";
import { Card, SectionTitle } from "@/components/dashboard/ui";

export default function SellerStore({
  sellerSlug,
}: {
  sellerSlug: string;
}) {
  const products = extendedCatalog.filter(
    (item) => item.seller.slug === sellerSlug
  );
  const sellerName = products[0]?.seller.name ?? "Seller";

  return (
    <div className="w-full px-6 pb-10 pt-6">
      <div className="mb-6">
        <SectionTitle title={`${sellerName} Store`} subtitle={`${products.length} items`} />
      </div>

      {products.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">
            No products found for this seller.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {products.map((item) => (
            <Link key={item.id} href={`/products/${item.id}`}>
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
