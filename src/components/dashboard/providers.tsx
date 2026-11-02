"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { createAppQueryClient } from "./queryClient";

export default function DashboardProviders({ children }: { children: ReactNode }) {
  const user = useAuthUser();
  const scope = user ? `${user.id || user.email}:${user.role}:${getAuth()?.access_token || ""}` : "guest";
  // Each sign-in owns its cache; private results cannot follow an account switch.
  const client = useMemo(() => createAppQueryClient(), [scope]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}