"use client";

import dynamic from "next/dynamic";
import PagePending from "@/components/PagePending";

const AppRouter = dynamic(() => import("@/components/AppRouter"), { ssr: false, loading: PagePending });

export default function Page() {
  return <AppRouter />;
}
