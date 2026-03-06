import Link from "next/link";
import { ErrorState } from "@/components/dashboard/ui";
import { getProductById } from "@/components/products/catalog";
import ProductDetail from "@/components/products/ProductDetail";
import ProductPageClient from "@/app/products/[id]/ProductPageClient";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) {
    return (
      <ProductPageClient>
        <div className="w-full px-6 pb-10 pt-6">
          <ErrorState message="Product not found." />
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Debug: params.id = {id}
          </div>
          <div className="mt-4">
            <Link href="/" className="text-sm font-semibold text-brand">
              Back to home
            </Link>
          </div>
        </div>
      </ProductPageClient>
    );
  }

  return (
    <ProductPageClient>
      <div className="w-full px-6 pb-10 pt-6">
        <ProductDetail
          product={product}
          backLink={
            <Link href="/" className="text-sm font-semibold text-brand">
              Back to home
            </Link>
          }
        />
      </div>
    </ProductPageClient>
  );
}
