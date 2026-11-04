"use client";

import { useEffect, useState } from "react";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { ChatClient, type ChatUser } from "@/components/chat/chatClient";
import type { Product } from "@/components/products/catalog";
import { needsSellerName, resolveSellerName } from "./sellerNames";

// Share read-only directory requests across cards and details for the same session.
// No Messages session or conversation is created as a side effect of browsing.
const directories = new Map<string, { expires: number; request: Promise<ChatUser[]> }>();

export function useSellerName(seller: Product["seller"], preview = false) {
  const user = useAuthUser();
  const [directory, setDirectory] = useState<{ stamp: string; accounts: ChatUser[] } | null>(null);
  const enabled = !preview && user?.role === "buyer" && Boolean(user.id) && needsSellerName(seller);
  let stamp = "";
  if (enabled) { try { stamp = accountStamp(); } catch { /* Signed-out browsing keeps the listing label. */ } }

  useEffect(() => {
    if (!stamp) return;
    let active = true;
    const now = Date.now();
    for (const [key, value] of directories) if (value.expires <= now) directories.delete(key);
    let cached = directories.get(stamp);
    if (!cached) {
      const client = new ChatClient();
      cached = { expires: now + 5 * 60 * 1000, request: client.sellers() };
      directories.set(stamp, cached);
    }
    cached.request.then(accounts => {
      checkAccount(stamp);
      if (active) setDirectory({ stamp, accounts });
    }).catch(() => { /* An unavailable directory leaves the fallback name intact. */ });
    return () => { active = false; };
  }, [stamp]);
  // A failed or incomplete directory never blocks shopping or invents an identity.
  return resolveSellerName(seller, stamp && directory?.stamp === stamp ? directory.accounts : undefined);
}
