"use client";

import { useSearchParams } from "react-router-dom";
import ChatWorkspace from "@/components/chat/ChatWorkspace";

export default function VendorMessages() {
  const [params] = useSearchParams();
  const conversationId = params.get("conversationId") || "";
  return <ChatWorkspace conversationId={/^[a-zA-Z0-9-]{1,100}$/.test(conversationId) ? conversationId : undefined} />;
}
