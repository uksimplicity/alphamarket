"use client";

import { useSellerName } from "@/components/dashboard/useSellerName";
import type { BuyerOrder } from "./buyerOrders";
import { firstName } from "./firstName";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { authGeneration } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "./localAccountData";
import { ChatClient } from "@/components/chat/chatClient";
import { findOrderParticipantName } from "./orderConversationName";

export default function BuyerOrderSeller({ order }: { order: Pick<BuyerOrder, "id" | "sellerId" | "vendor"> }) {
  const user = useAuthUser();
  const supplied = order.vendor.trim();
  const name = useSellerName({ id: order.sellerId, name: !supplied || supplied.toLowerCase() === "seller" ? "Marketplace seller" : supplied, slug: "" });
  const missing = !name.trim() || ["marketplace seller", "seller"].includes(name.trim().toLowerCase());
  const key = `${user?.id || ""}:${authGeneration()}:${order.id}:${order.sellerId}`;
  const [conversation, setConversation] = useState<{ key: string; name: string } | null>(null);
  useEffect(() => {
    if (!missing || !user?.id || !order.id) return;
    const controller = new AbortController();
    void (async () => {
      const stamp = accountStamp(), client = new ChatClient();
      const result = await findOrderParticipantName(offset => client.threads(offset, controller.signal), order.id, order.sellerId, "seller");
      checkAccount(stamp);
      if (!controller.signal.aborted && result) setConversation({ key, name: result });
    })().catch(() => { /* Keep the placeholder if no verified conversation is available. */ });
    return () => controller.abort();
  }, [missing, user?.id, order.id, order.sellerId, key]);
  const display = missing ? (conversation?.key === key ? conversation.name : "") : name;
  return <span>Seller: {firstName(display) || "Name not reported"}</span>;
}
