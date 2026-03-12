"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import HomeScreen from "@/components/dashboard/HomeScreen";
import { fetcher } from "@/components/dashboard/api";
import { getAuth, getDisplayName } from "@/components/auth/authStorage";

type UserProfile = {
  name: string;
};

export default function DashboardHomePage() {
  const { data } = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: () => fetcher<UserProfile>("/dashboard/profile"),
  });
  const [storedName, setStoredName] = useState("");

  useEffect(() => {
    const auth = getAuth();
    setStoredName(getDisplayName(auth?.user));
  }, []);

  const userName = data?.name || storedName || "My Account";

  return <HomeScreen userName={userName} />;
}
