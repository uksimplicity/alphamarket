import type { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import DashboardProviders from "@/components/dashboard/providers";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProviders>
      <AdminShell>{children}</AdminShell>
    </DashboardProviders>
  );
}
