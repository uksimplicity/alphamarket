import type { ChatThread } from "@/components/chat/chatClient";

type ThreadPage = { threads: ChatThread[]; total: number };
export async function findOrderParticipantName(loadPage: (offset: number) => Promise<ThreadPage>, orderId: string, participantId: string, role: "buyer" | "seller") {
  if (!orderId) return "";
  const matches = new Map<string, string>();
  let complete = false;
  for (let offset = 0; offset < 200; offset += 20) {
    const page = await loadPage(offset);
    for (const thread of page.threads) {
      if (thread.type !== "order" || thread.contextId !== orderId || !thread.peer.id || !thread.peer.name.trim()) continue;
      if (participantId ? thread.peer.id !== participantId : thread.peer.role.trim().toLowerCase() !== role) continue;
      matches.set(thread.peer.id, thread.peer.name.trim());
    }
    if (offset + page.threads.length >= page.total) { complete = true; break; }
    if (!page.threads.length) break;
  }
  return matches.size === 1 && (participantId || complete) ? [...matches.values()][0] : "";
}
export const findOrderBuyerName = (loadPage: (offset: number) => Promise<ThreadPage>, orderId: string, buyerId: string) => findOrderParticipantName(loadPage, orderId, buyerId, "buyer");
