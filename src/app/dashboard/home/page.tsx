"use client";

import { useQuery } from "@tanstack/react-query";
import HomeScreen from "@/components/dashboard/HomeScreen";
import { fetcher } from "@/components/dashboard/api";

type UserProfile = {
  name: string;
};

export default function DashboardHomePage() {
  const { data } = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: () => fetcher<UserProfile>("/dashboard/profile"),
  });

  const userName = data?.name ?? "Alex";

  return <HomeScreen userName={userName} />;
}
