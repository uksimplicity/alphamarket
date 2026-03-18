"use client";

import { useQuery } from "@tanstack/react-query";
import HomeScreen from "@/components/dashboard/HomeScreen";
import { fetchCurrentUserProfile } from "@/components/auth/profileClient";
import { getDisplayName } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";

export default function DashboardHomePage() {
  const { data } = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: fetchCurrentUserProfile,
  });
  const authUser = useAuthUser();
  const storedName = getDisplayName(authUser);

  const userName = data?.name || storedName || "My Account";

  return <HomeScreen userName={userName} />;
}
