import StorePageClient from "@/app/store/[slug]/StorePageClient";
import SellerStore from "@/components/store/SellerStore";

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <StorePageClient>
      <SellerStore sellerSlug={slug} />
    </StorePageClient>
  );
}
