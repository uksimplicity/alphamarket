"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type ProfileData = {
  name: string;
  email: string;
  phone: string;
  addresses: Array<{ id: string; label: string; detail: string }>;
  preferences: Array<{ id: string; label: string; enabled: boolean }>;
  payments: Array<{ id: string; date: string; amount: string; method: string }>;
};

export default function ProfilePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: () => fetcher<ProfileData>("/dashboard/profile"),
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load profile."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">
          Account Overview
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Card className="rounded-xl border border-slate-200 shadow-none">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Account Details
            </div>
            <div className="space-y-2 px-4 py-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">{data.name}</div>
              <div>{data.email}</div>
            </div>
          </Card>

          <Card className="rounded-xl border border-slate-200 shadow-none">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Address Book
              <Button className="h-8 px-3 text-xs" variant="ghost">
                Edit
              </Button>
            </div>
            <div className="space-y-2 px-4 py-4 text-sm text-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Your default shipping address:
              </div>
              <div className="font-semibold text-slate-900">
                {data.addresses[0]?.label ?? "No default address"}
              </div>
              <div>{data.addresses[0]?.detail ?? "Add an address to continue."}</div>
              <div>{data.phone}</div>
            </div>
          </Card>

          <Card className="rounded-xl border border-slate-200 shadow-none">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Alpha Store Credit
            </div>
            <div className="flex items-center gap-3 px-4 py-6 text-sm text-slate-700">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                  <path
                    d="M4 6h16v12H4V6zm3 3h6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <div className="font-semibold text-slate-900">Alpha store credit balance:</div>
                <div>₦ 0</div>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border border-slate-200 shadow-none">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
              Newsletter Preferences
            </div>
            <div className="space-y-3 px-4 py-4 text-sm text-slate-700">
              <div>
                Manage your email communications to stay updated with the latest news and offers.
              </div>
              <Button className="h-8 px-3 text-xs" variant="ghost">
                Edit newsletter preferences
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
