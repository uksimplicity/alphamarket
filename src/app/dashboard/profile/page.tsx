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
      <Card>
        <SectionTitle title="Personal Information" subtitle="Manage your account profile." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <input className="rounded-xl border border-slate-200 px-4 py-2 text-sm" defaultValue={data.name} />
          <input className="rounded-xl border border-slate-200 px-4 py-2 text-sm" defaultValue={data.email} />
          <input className="rounded-xl border border-slate-200 px-4 py-2 text-sm" defaultValue={data.phone} />
          <Button>Save Changes</Button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Shipping Addresses" subtitle="Manage your delivery locations." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {data.addresses.map((address) => (
            <div key={address.id} className="rounded-xl border border-slate-200 p-4 text-sm">
              <div className="font-semibold text-slate-800">{address.label}</div>
              <div className="text-slate-500">{address.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Password" subtitle="Update your login credentials." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <input className="rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="New password" type="password" />
          <input className="rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Confirm password" type="password" />
          <Button>Change Password</Button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Preferences" subtitle="Choose how you want to hear from us." />
        <div className="mt-4 grid gap-3">
          {data.preferences.map((pref) => (
            <label key={pref.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm">
              <span>{pref.label}</span>
              <input type="checkbox" defaultChecked={pref.enabled} />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Payment History" subtitle="Your recent transactions." />
        <div className="mt-4 space-y-3 text-sm">
          {data.payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div>
                <div className="font-semibold text-slate-800">{payment.amount}</div>
                <div className="text-xs text-slate-500">{payment.method}</div>
              </div>
              <div className="text-xs text-slate-500">{payment.date}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
