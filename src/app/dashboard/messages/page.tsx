import ChatWorkspace from "@/components/chat/ChatWorkspace";
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ seller?: string; product?: string }> }) {
  const query = await searchParams;
  return <ChatWorkspace sellerId={typeof query.seller === "string" && query.seller.length <= 200 ? query.seller : undefined} productTitle={typeof query.product === "string" ? query.product.slice(0, 200) : undefined} />;
}
