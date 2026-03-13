"use client";

import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
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
    queryFn: async () => {
      const payload = await adminFetcher<unknown>("/users?limit=100");
      const rows = asArray(payload);

      const admins = rows
        .map((row) => {
          const record = asRecord(row);
          const role = pickString(record, ["role", "userRole", "account_role"]);
          return {
            id: pickString(record, ["id", "user_id", "uuid"]),
            name:
              pickString(record, ["name", "full_name"]) ||
              `${pickString(record, ["first_name"])} ${pickString(record, ["last_name"])}`
                .trim() ||
              pickString(record, ["email"], "Unknown admin"),
            role,
          };
        })
        .filter((admin) => admin.id)
        .filter((admin) => admin.role.includes("admin"));

      const roles = [
        { id: "buyer", name: "buyer", permissions: 1 },
        { id: "seller", name: "seller", permissions: 3 },
        { id: "marketplace_admin", name: "marketplace_admin", permissions: 8 },
        { id: "rider_admin", name: "rider_admin", permissions: 6 },
        { id: "super_admin", name: "super_admin", permissions: 10 },
      ];

      return { roles, admins } satisfies SettingsData;
    },
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
