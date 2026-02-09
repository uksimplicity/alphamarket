"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navSections = [
  {
    title: "Product Management",
    items: [
      { href: "/admin/products", label: "Manage Product" },
      { href: "/admin/products", label: "Categories & Attributes" },
      { href: "/admin/products", label: "Manage Inventory" },
    ],
  },
  {
    title: "Order Management",
    items: [
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/orders", label: "Escrow System" },
      { href: "/admin/orders", label: "Disputes & Refunds" },
      { href: "/admin/finance", label: "Transactions" },
    ],
  },
  {
    title: "User Management",
    items: [
      { href: "/admin/users", label: "All Users" },
      { href: "/admin/vendors", label: "Vendors" },
    ],
  },
  {
    title: "Reports & Analytics",
    items: [
      { href: "/admin/dashboard", label: "Sales reports" },
      { href: "/admin/dashboard", label: "Seller performance" },
      { href: "/admin/dashboard", label: "Top products, categories" },
    ],
  },
  {
    title: "Finance Management",
    items: [
      { href: "/admin/finance", label: "Earning" },
      { href: "/admin/finance", label: "Withdraws" },
      { href: "/admin/finance", label: "Refunds" },
    ],
  },
  {
    title: "Promotional Deals",
    items: [
      { href: "/admin/promotions", label: "Coupon" },
      { href: "/admin/promotions", label: "Flash Sales" },
      { href: "/admin/promotions", label: "Featured Deal" },
    ],
  },
  {
    title: "Help & Support",
    items: [
      { href: "/admin/notifications", label: "Inbox" },
      { href: "/admin/notifications", label: "Support & Ticket" },
    ],
  },
  {
    title: "Settings",
    items: [{ href: "/admin/settings", label: "General Settings" }],
  },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="mb-6 flex items-center gap-2 font-semibold text-slate-900">
            <img className="h-8" src="/logo.png" alt="Alpha Marketplace" />
            Alpha Marketplace
          </div>
          <Link
            href="/admin/dashboard"
            className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              pathname === "/admin/dashboard"
                ? "bg-brand/10 text-brand"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Dashboard
          </Link>
          <nav className="flex flex-col gap-4 text-sm">
            {navSections.map((section) => (
              <div key={section.title}>
                <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {section.title}
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={`${section.title}-${item.label}`}
                        href={item.href}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                          active
                            ? "bg-brand/10 text-brand"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-4">
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
                aria-label="Collapse sidebar"
              >
                ‹
              </button>
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
                <span>🔍</span>
                <input
                  className="w-full bg-transparent outline-none"
                  placeholder="Search..."
                />
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>🇬🇧</span>
                <span>⌄</span>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs">
                  🔔
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                    5
                  </span>
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs">
                  ✉️
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                    8
                  </span>
                </div>
                <div className="group relative flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-brand/20" />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-800">Alexa Smith</div>
                    <div className="text-slate-400">Super Admin</div>
                  </div>
                  <span className="text-slate-400">▾</span>
                  <div className="absolute right-0 top-12 hidden min-w-[160px] rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow-card group-hover:block">
                    <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-600">
                      Profile
                    </button>
                    <Link
                      href="/login"
                      className="block w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-600"
                    >
                      Logout
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
