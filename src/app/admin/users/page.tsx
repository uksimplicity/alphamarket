"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickNumber, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type User = {
  id: string;
  name: string;
  email: string;
  status: string;
  orders: number;
  role: "buyer" | "seller" | "rider" | "super_admin";
};

function normalizeUserRole(value: string): User["role"] {
  const role = value.toLowerCase().trim();
  if (role === "seller" || role === "vendor") return "seller";
  if (role === "rider" || role === "delivery_rider") return "rider";
  if (role === "super_admin" || role === "admin" || role === "superadmin") {
    return "super_admin";
  }
  return "buyer";
}

export default function AdminUsersPage() {
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const payload = await adminFetcher<unknown>("/users?limit=100");
      const rows = asArray(payload);

      return rows.map((row, index) => {
        const record = asRecord(row);

        return {
          id: pickString(record, ["id", "user_id", "uuid"], `user-${index}`),
          name:
            pickString(record, ["name", "full_name"]) ||
            `${pickString(record, ["first_name"])} ${pickString(record, ["last_name"])}`
              .trim() ||
            pickString(record, ["email"], "Unknown user"),
          email: pickString(record, ["email"], "No email"),
          status: pickString(record, ["status"], "unknown"),
          orders: pickNumber(record, ["orders", "orders_count", "total_orders"], 0),
          role: normalizeUserRole(
            pickString(record, ["role", "user_type", "type"], "buyer")
          ),
        } satisfies User;
      });
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
        message={error instanceof Error ? error.message : "Failed to load users."}
        onRetry={refetch}
      />
    );
  }

  async function updateUserStatus(userId: string, status: "active" | "suspended") {
    try {
      setActionError("");
      setPendingUserId(userId);

      await adminFetcher(`/users/${userId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update user status."
      );
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <Card>
      <SectionTitle title="Users" subtitle="Manage account access and status." />
      {actionError ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-200">
        <div className="hidden grid-cols-[2.2fr_1fr_1fr_1.2fr] gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <div>User</div>
          <div>Orders</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>

        <div className="divide-y divide-slate-200">
          {data.map((user) => {
            const status = user.status.toLowerCase();
            const isPendingRow = pendingUserId === user.id;
            const badgeTone =
              status === "active"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : status === "pending"
                ? "bg-amber-50 text-amber-700 ring-amber-200"
                : "bg-slate-100 text-slate-700 ring-slate-200";
            const roleTone =
              user.role === "super_admin"
                ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                : user.role === "seller"
                ? "bg-brand text-white ring-blue-400"
                : user.role === "rider"
                ? "bg-rose-100 text-rose-800 ring-rose-300"
                : "bg-sky-100 text-sky-800 ring-sky-300";

            return (
              <div
                key={user.id}
                className="grid gap-4 px-4 py-4 md:grid-cols-[2.2fr_1fr_1fr_1.2fr] md:items-center md:px-5"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{user.name}</div>
                  <div className="truncate text-sm text-slate-500">{user.email}</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${roleTone}`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-slate-600">
                  <span className="md:hidden text-xs uppercase tracking-wide text-slate-400">
                    Orders:{" "}
                  </span>
                  {user.orders}
                </div>

                <div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${badgeTone}`}
                  >
                    {user.status}
                  </span>
                </div>

                <div className="flex justify-start gap-2 md:justify-end">
                  <Button
                    variant="ghost"
                    disabled={isPendingRow}
                    onClick={() => updateUserStatus(user.id, "suspended")}
                  >
                    {isPendingRow
                      ? "Updating..."
                      : status === "suspended"
                      ? "Suspended"
                      : "Suspend"}
                  </Button>
                  <Button
                    variant={status === "active" ? "ghost" : "primary"}
                    disabled={isPendingRow}
                    onClick={() => updateUserStatus(user.id, "active")}
                  >
                    {isPendingRow
                      ? "Updating..."
                      : status === "active"
                      ? "Activated"
                      : "Activate"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
