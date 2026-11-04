import ChatWorkspace from "@/components/chat/ChatWorkspace";
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ productId?: string; product?: string }> }) {
  const query = await searchParams;
  return <ChatWorkspace productId={typeof query.productId === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(query.productId) ? query.productId : undefined} productTitle={typeof query.product === "string" ? query.product.slice(0, 200) : undefined} />;
}
