"use client";

import { useEffect } from "react";

function isExtensionRuntimeError(event: ErrorEvent) {
  const source = event.filename ?? "";
  if (!source.startsWith("chrome-extension://")) return false;
  const message = String(event.message ?? "").toLowerCase();
  return message.includes("cannot redefine property") && message.includes("ethereum");
}

function isExtensionUnhandledRejection(event: PromiseRejectionEvent) {
  const reason = event.reason;
  const text =
    typeof reason === "string"
      ? reason
      : reason && typeof reason === "object" && "message" in reason
        ? String((reason as { message?: unknown }).message ?? "")
        : "";
  const message = text.toLowerCase();
  return message.includes("cannot redefine property") && message.includes("ethereum");
}

export default function DevExtensionErrorGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const onError = (event: ErrorEvent) => {
      if (!isExtensionRuntimeError(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isExtensionUnhandledRejection(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
