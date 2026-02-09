import type { ReactNode } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardProviders from "@/components/dashboard/providers";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProviders>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProviders>
  );
}
