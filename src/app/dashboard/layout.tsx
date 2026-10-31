import type { ReactNode } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardProviders from "@/components/dashboard/providers";
import SessionBoundary from "@/components/auth/SessionBoundary";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProviders>
      <SessionBoundary><DashboardShell>{children}</DashboardShell></SessionBoundary>
    </DashboardProviders>
  );
}
