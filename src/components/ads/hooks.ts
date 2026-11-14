"use client";
import { useEffect, useRef, useState } from "react";
import { authGeneration } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { adsRequest, AdsError, fetchPostingCost, loadDirectory, type PostingCost } from "./client";
import type { AdRecord } from "./data";

export function useAdsDirectory(path: string, authenticated = false) {
  const [attempt, setAttempt] = useState(0);
  const key = `${path}:${attempt}`;
  const [state, setState] = useState<{ key: string; data?: AdRecord[]; error?: string }>({ key: "" });
  useEffect(() => {
    let active = true;
    void loadDirectory(path, authenticated).then(data => { if (active) setState({ key, data }); })
      .catch(error => { if (active) setState({ key, error: error instanceof Error ? error.message : "Could not load choices." }); });
    return () => { active = false; };
  }, [path, key, authenticated]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined, refresh: () => setAttempt(value => value + 1) };
}

export function useAdsResource(path: string, authenticated = true) {
  const user = useAuthUser();
  const [attempt, setAttempt] = useState(0);
  const key = `${path}:${attempt}:${authenticated ? `${user?.id}:${authGeneration()}` : "public"}`;
  const [state, setState] = useState<{ key: string; data?: unknown; error?: string }>({ key: "" });
  useEffect(() => {
    if (!path) return;
    let active = true;
    void adsRequest(path, {}, authenticated).then(data => { if (active) setState({ key, data }); })
      .catch(error => { if (active) setState({ key, error: error instanceof Error ? error.message : "Could not load this page." }); });
    return () => { active = false; };
  }, [path, key, authenticated]);
  const current = state.key === key ? state : null;
  return { data: current?.data, error: current?.error, loading: Boolean(path) && !current, refresh: () => setAttempt(value => value + 1) };
}
export function usePostingCost(categoryId: string) {
  const user = useAuthUser();
  const [attempt, setAttempt] = useState(0);
  const key = `${categoryId}:${user?.id}:${authGeneration()}:${attempt}`;
  const [state, setState] = useState<{ key: string; cost?: PostingCost; error?: string }>({ key: "" });
  useEffect(() => {
    if (!categoryId) return;
    let active = true;
    void fetchPostingCost(categoryId).then(cost => { if (active) setState({ key, cost }); })
      .catch(error => { if (active) setState({ key, error: error instanceof Error ? error.message : "Could not check posting fee." }); });
    return () => { active = false; };
  }, [categoryId, key]);
  return { cost: state.key === key ? state.cost : undefined, error: state.key === key ? state.error : undefined, loading: Boolean(categoryId) && state.key !== key, refresh: () => setAttempt(value => value + 1) };
}
export function useAdsMutation() {
  const lock = useRef(false);
  const uncertainLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  async function run(path: string, method: string, body?: unknown): Promise<boolean> {
    if (lock.current || uncertainLock.current) return false;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await adsRequest(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (typeof window !== "undefined" && (path.startsWith("/api/my-ads") || /^\/api\/admin\/ads\/(?!fees(?:\/|$)|stats|moderation-logs)/.test(path))) {
        window.dispatchEvent(new Event("alpha-products-updated"));
      }
      setMessage("Saved successfully."); return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save this change.");
      if (!(failure instanceof AdsError) || failure.status === 0 || failure.status >= 500) { uncertainLock.current = true; setUncertain(true); }
      return false;
    } finally { lock.current = false; setBusy(false); }
  }
  return { run, busy, error, message, uncertain, disabled: busy || uncertain };
}
