import type { ChatThread } from "@/components/chat/chatClient";

type ThreadPage = { threads: ChatThread[]; total: number };
export async function findOrderBuyerName(loadPage: (offset: number) => Promise<ThreadPage>, orderId: string, buyerId: string) {
  if (!orderId) return "";
  const matches = new Map<string, string>();
  let complete = false;
  for (let offset = 0; offset < 200; offset += 20) {
    const page = await loadPage(offset);
    for (const thread of page.threads) {
      if (thread.type !== "order" || thread.contextId !== orderId || !thread.peer.id || !thread.peer.name.trim()) continue;
      if (buyerId ? thread.peer.id !== buyerId : thread.peer.role.trim().toLowerCase() !== "buyer") continue;
      matches.set(thread.peer.id, thread.peer.name.trim());
    }
    if (offset + page.threads.length >= page.total) { complete = true; break; }
    if (!page.threads.length) break;
  }
  return matches.size === 1 && (buyerId || complete) ? [...matches.values()][0] : "";
}
