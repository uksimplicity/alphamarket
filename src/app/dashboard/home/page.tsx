"use client";

import { useQuery } from "@tanstack/react-query";
import HomeScreen from "@/components/dashboard/HomeScreen";
import { fetchCurrentUserProfile } from "@/components/auth/profileClient";
import { getDisplayName } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function DashboardHomePage() {
  return <Suspense fallback={<p className="p-6" role="status">Loading your marketplace...</p>}><DashboardHomeContent /></Suspense>;
}

function DashboardHomeContent() {
  const params = useSearchParams();
  const authUser = useAuthUser();
  const { data } = useQuery({
    queryKey: ["dashboard-profile", authUser?.id],
    queryFn: fetchCurrentUserProfile,
    enabled: !!authUser?.id,
  });
  const storedName = getDisplayName(authUser);

  const userName = data?.name || storedName || "My Account";

  const search = params.get("q") ?? "", category = params.get("category") ?? "All finds";
  return <HomeScreen key={`${search}:${category}`} userName={userName} initialSearch={search} initialCategory={category} />;
}
