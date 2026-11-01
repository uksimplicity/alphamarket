import type { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import DashboardProviders from "@/components/dashboard/providers";
import AdminToastProvider from "@/components/admin/AdminToastProvider";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProviders>
      <AdminToastProvider>
        <AdminShell>{children}</AdminShell>
      </AdminToastProvider>
    </DashboardProviders>
  );
}
