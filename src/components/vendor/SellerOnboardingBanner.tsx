"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { authGeneration, getAuth, setAuth } from "@/components/auth/authStorage";
import { rememberSession, verifySession } from "@/components/auth/sessionClient";
import { sellerOnboarding } from "./sellerOnboarding";
import styles from "./sellerShell.module.css";

export default function SellerOnboardingBanner({ status, hasStore }: { status?: string; hasStore: boolean }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const notice = sellerOnboarding(status, hasStore);
  if (!notice) return null;

  async function refresh() {
    const saved = getAuth(), epoch = authGeneration();
    if (!saved || checking) return;
    setChecking(true); setError("");
    try {
      const profile = await verifySession(saved, true);
      if (authGeneration() !== epoch) return;
      const next = { ...saved, user: profile };
      setAuth(next);
      rememberSession(next, profile);
    } catch (failure) {
      if (authGeneration() === epoch) setError(failure instanceof Error ? failure.message : "Could not check activation. Please retry.");
    } finally { setChecking(false); }
  }

  return <section className={styles.onboarding} aria-label="Seller setup and activation">
    <div><strong>{notice.title}</strong><p>{notice.message}</p>{error ? <p role="alert">{error}</p> : null}</div>
    <div className={styles.onboardingActions}>
      {notice.href.startsWith("/") ? <Link to={notice.href}>{notice.action}</Link> : <a href={notice.href}>{notice.action}</a>}
      {status?.trim().toLowerCase() !== "active" ? <button type="button" disabled={checking} onClick={refresh}>{checking ? "Checking…" : "Check activation"}</button> : null}
    </div>
  </section>;
}
