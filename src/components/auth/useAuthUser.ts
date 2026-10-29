"use client";

import { useSyncExternalStore } from "react";
import { AUTH_UPDATED_EVENT, getAuth, type AuthUser } from "@/components/auth/authStorage";

let lastRawAuth = "";
let lastUserSnapshot: AuthUser | null = null;

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function onStorage(event: StorageEvent) {
    if (event.key === "alpha.auth" || event.key === null) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_UPDATED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTH_UPDATED_EVENT, onStoreChange);
  };
}

function getSnapshot(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  let raw = "";
  try {
    raw = window.localStorage.getItem("alpha.auth") ?? "";
  } catch {
    return null;
  }
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
