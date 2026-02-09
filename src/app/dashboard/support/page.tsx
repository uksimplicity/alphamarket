"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
};

type SupportData = {
  tickets: Ticket[];
  faqs: Array<{ id: string; question: string; answer: string }>;
};

export default function SupportPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-support"],
    queryFn: () => fetcher<SupportData>("/dashboard/support"),
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
        message={error instanceof Error ? error.message : "Failed to load support data."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="Support Tickets" subtitle="Track your open requests." />
        <div className="mt-4 space-y-3">
          {data.tickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-sm">
              <div>
                <div className="font-semibold text-slate-800">{ticket.subject}</div>
                <div className="text-xs text-slate-500">Updated {ticket.updatedAt}</div>
              </div>
              <Button variant="ghost">{ticket.status}</Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="FAQs" subtitle="Quick answers to common questions." />
        <div className="mt-4 space-y-4 text-sm">
          {data.faqs.map((faq) => (
            <div key={faq.id}>
              <div className="font-semibold text-slate-800">{faq.question}</div>
              <p className="text-slate-500">{faq.answer}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
