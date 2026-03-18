"use client";

import { useSyncExternalStore } from "react";
import { getAuth, type AuthUser } from "@/components/auth/authStorage";

let lastRawAuth = "";
let lastUserSnapshot: AuthUser | null = null;

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function onStorage(event: StorageEvent) {
    if (event.key === "alpha.auth") {
      onStoreChange();
    }
  }

  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function getSnapshot(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem("alpha.auth") ?? "";
  if (raw === lastRawAuth) {
    return lastUserSnapshot;
  }

  lastRawAuth = raw;
  lastUserSnapshot = getAuth()?.user ?? null;
  return lastUserSnapshot;
}

function getServerSnapshot(): AuthUser | null {
  return null;
}

export function useAuthUser() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
