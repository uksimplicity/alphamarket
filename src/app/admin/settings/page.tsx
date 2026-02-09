"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type AdminAccount = {
  id: string;
  name: string;
  role: string;
};

type SettingsData = {
  roles: Array<{ id: string; name: string; permissions: number }>;
  admins: AdminAccount[];
};

export default function AdminSettingsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => fetcher<SettingsData>("/admin/settings"),
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load settings."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle
          title="Roles & Permissions"
          subtitle="Manage access levels."
          action={<Button>Create Role</Button>}
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.roles.map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div className="font-semibold text-slate-800">{role.name}</div>
              <div className="text-xs text-slate-500">
                {role.permissions} permissions
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="Admin Accounts"
          subtitle="Manage admin access."
          action={<Button>Add Admin</Button>}
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.admins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{admin.name}</div>
                <div className="text-xs text-slate-500">{admin.role}</div>
              </div>
              <Button variant="ghost">Deactivate</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
