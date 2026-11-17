"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { authGeneration } from "@/components/auth/authStorage";
import { ChatClient } from "@/components/chat/chatClient";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import styles from "./orderDetails.module.css";

function Contact({ orderId, sellerId }: { orderId: string; sellerId: string }) {
  const router = useRouter();
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => () => request.current?.abort(), []);
  async function open() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError("");
    try {
      const thread = await new ChatClient().startOrder(orderId, sellerId, controller.signal);
      if (!controller.signal.aborted) router.push(`/dashboard/messages?conversationId=${encodeURIComponent(thread.id)}`);
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not open the seller conversation."); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }
  return <div><button type="button" className={styles.contactButton} disabled={busy} onClick={() => void open()}><ShopperIcon name="chat" size={15} />{busy ? "Opening..." : "Chat with seller"}</button>{error ? <p role="alert" className={styles.alert}>{error}</p> : null}</div>;
}
export default function BuyerOrderContact(props: { orderId: string; sellerId: string }) {
  const user = useAuthUser();
  return user?.id ? <Contact key={`${user.id}:${authGeneration()}:${props.orderId}:${props.sellerId}`} {...props} /> : null;
}
