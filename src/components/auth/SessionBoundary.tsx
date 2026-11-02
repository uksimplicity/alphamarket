"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { authGeneration, clearAuth, getAuth, isSellerRole, setAuth } from "./authStorage";
import { useAuthReady, useAuthUser } from "./useAuthUser";
import { tokenExpired } from "./sessionValidation";
import { cachedSession, rememberSession, verifySession } from "./sessionClient";
import PagePending from "../PagePending";

export default function SessionBoundary({ children, seller = false }: { children: ReactNode; seller?: boolean }) {
  const user = useAuthUser();
  const ready = useAuthReady();
  const token = user ? getAuth()?.access_token || "" : "";
  const sessionKey = `${authGeneration()}:${seller ? "seller" : "buyer"}:${token}:${user?.id || user?.email || ""}`;
  const [verified, setVerified] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const saved = getAuth(), epoch = authGeneration();
    const same = () => active && getAuth()?.access_token === saved?.access_token && authGeneration() === epoch;
    async function verify() {
      setVerified(""); setError("");
      if (!saved) return;
      if (tokenExpired(saved.access_token)) { if (same()) clearAuth(); return; }
      try {
        const profile = await verifySession(saved);
        if (!same()) return;
        if (["admin", "marketplace_admin", "rider_admin", "super_admin"].includes(profile.role || "")) { window.location.replace("/admin/dashboard"); return; }
        if (seller && !isSellerRole(profile.role)) throw new Error("A seller account approved by the service is required for this workspace.");
        if (!seller && isSellerRole(profile.role)) { window.location.replace("/vendor"); return; }
        if (JSON.stringify(saved.user) !== JSON.stringify(profile)) setAuth({ ...saved, user: profile });
        rememberSession({ ...saved, user: profile }, profile);
        setVerified(sessionKey);
      } catch (failure) {
        if (same()) {
          if (failure instanceof Error && (failure.message.startsWith("The saved sign-in does not match") || failure.message.startsWith("Your session has expired"))) clearAuth();
          else setError(failure instanceof Error ? failure.message : "Your sign-in could not be checked. Please retry.");
        }
      }
    }
    void verify();
    return () => { active = false; };
  }, [sessionKey, seller, revision]);
  useEffect(() => {
    const expire = () => { const saved = getAuth(); if (saved && tokenExpired(saved.access_token)) clearAuth(); };
    const timer = setInterval(expire, 15000);
    window.addEventListener("focus", expire); document.addEventListener("visibilitychange", expire);
    const original = window.fetch;
    const wrapped: typeof fetch = async (input, init) => {
      const epoch = authGeneration();
      const auth = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get("authorization");
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
      const response = await original(input, init);
      const current = getAuth();
      if (response.status === 401 && url.origin === window.location.origin && url.pathname.startsWith("/api/") && current && epoch === authGeneration() && auth === `Bearer ${current.access_token.replace(/^Bearer\s+/i, "").trim()}`) clearAuth();
      return response;
    };
    window.fetch = wrapped;
    return () => { clearInterval(timer); window.removeEventListener("focus", expire); document.removeEventListener("visibilitychange", expire); if (window.fetch === wrapped) window.fetch = original; };
  }, []);
  if (!ready) return <PagePending />;
  if (!token) return <section className="mx-auto max-w-xl p-8"><h1 className="text-xl font-semibold">Please sign in</h1><Link href={seller ? "/login/vendor" : "/login/user"} className="text-blue-600">Continue to sign in</Link></section>;
  if (error) return <section className="mx-auto max-w-xl p-8" role="alert"><p>{error}</p><button type="button" className="mt-4 rounded border px-4 py-2" onClick={() => setRevision(r => r + 1)}>Retry</button> <Link href="/login">Sign in again</Link></section>;
  const cached = cachedSession(getAuth());
  const cachedAllowed = cached && (seller ? isSellerRole(cached.role) : !isSellerRole(cached.role) && !["admin", "marketplace_admin", "rider_admin", "super_admin"].includes(cached.role || ""));
  if (verified !== sessionKey && !cachedAllowed) return <PagePending />;
  return children;
}
