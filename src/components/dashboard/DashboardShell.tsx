"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import type { ReactNode } from "react";

const topNavItems = [
  { href: "/dashboard/home", label: "Home" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/wishlist", label: "Wishlist" },
  { href: "/dashboard/cart", label: "Cart" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/support", label: "Support" },
];

const accountNavItems = [
  {
    label: "Orders",
    href: "/dashboard/orders",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M6 7h12l-1 12H7L6 7zm3-3h6l1 3H8l1-3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Inbox",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M4 6h16v12H4V6zm0 0l8 6 8-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Pending Reviews",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M6 4h8l4 4v12H6V4zm8 0v4h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Voucher",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M5 6h14v12H5V6zm0 4a2 2 0 1 0 0 4m14-4a2 2 0 1 1 0 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Wishlist",
    href: "/dashboard/wishlist",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Followed Sellers",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M4 7h16v10H4V7zm3 10V7m10 10V7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Recently Viewed",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M12 8v5l3 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
];

const accountManagementItems = [
  { label: "Payment Settings", href: "#" },
  { label: "Address Book", href: "#" },
  { label: "Newsletter Preferences", href: "#" },
  { label: "Close Account", href: "#" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: profile } = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: () => fetcher<{ name: string }>("/dashboard/profile"),
  });

  if (pathname === "/dashboard/home") {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-24 pt-6 lg:grid-cols-[240px_1fr] lg:pb-6">
        <aside className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:block">
          <div className="px-5 pt-5">
            <Link href="/" className="inline-flex items-center">
              <img src="/logo.png" alt="Alpha Marketplace" className="h-9 w-auto" />
            </Link>
          </div>
          <Link
            href="/dashboard/profile"
            className="mt-4 flex items-center gap-3 bg-slate-200/80 px-5 py-4 text-sm font-semibold text-slate-800"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <path
                  d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 9a7 7 0 0 1 14 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            My Alpha Account
          </Link>
          <nav className="flex flex-col">
            {accountNavItems.map((item) => {
              const active = item.href !== "#" && pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 border-b border-slate-100 px-5 py-3 text-sm font-medium transition ${
                    active ? "text-slate-900" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  aria-disabled={item.href === "#"}
                >
                  <span className="text-slate-700">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Account Management
          </div>
          <nav className="flex flex-col pb-4">
            {accountManagementItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-5 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                aria-disabled={item.href === "#"}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex flex-col gap-6">
          <header className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-card">
            <div className="grid items-center gap-4 lg:grid-cols-[auto_1fr_auto]">
              <div />

              <div className="flex w-full items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                <input
                  className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  placeholder="Search products, brands, and categories"
                />
                <button className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white">
                  Search
                </button>
              </div>

              <div className="flex items-center gap-6 text-xs font-medium text-slate-500">
                <button className="flex flex-col items-center gap-1">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                      <path
                        d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M9.5 19a2.5 2.5 0 005 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  Alerts
                </button>
                <button className="flex flex-col items-center gap-1">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                      <path
                        d="M4 6h16M4 12h16M4 18h10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  Orders
                </button>
                <button className="flex items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                      <circle
                        cx="12"
                        cy="8"
                        r="4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M4 20c1.8-4 13.2-4 16 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </span>
                  <span className="text-sm text-slate-700">
                    {profile?.name ?? "My Account"}
                  </span>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[10px] text-slate-500">
                    ▾
                  </span>
                </button>
                <button className="flex flex-col items-center gap-1">
                  <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                      <path
                        d="M6 6h15l-2 9H7L5 3H2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="9" cy="20" r="1.5" />
                      <circle cx="17" cy="20" r="1.5" />
                    </svg>
                    <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
                      2
                    </span>
                  </span>
                  Cart
                </button>
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>

      <nav className="fixed bottom-4 left-4 right-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-card backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-500">
          {topNavItems
            .filter((item) =>
              ["/dashboard/home", "/dashboard/orders", "/dashboard/wishlist", "/dashboard/profile"].includes(item.href)
            )
            .map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 text-center ${
                  active ? "bg-brand text-white" : "text-slate-600"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
