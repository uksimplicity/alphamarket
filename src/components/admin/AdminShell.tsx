"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getAuth, getDisplayName } from "@/components/auth/authStorage";

const navSections = [
  {
    title: "Catalog",
    items: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/promotions", label: "Categories" },
      { href: "/admin/promotions", label: "Brands & Tags" },
    ],
  },
  {
    title: "Escrow Management",
    items: [
      { href: "/admin/orders", label: "Pending Escrows" },
      { href: "/admin/orders", label: "Timed-out Escrows" },
      { href: "/admin/finance", label: "Revenue Report" },
      { href: "/admin/finance", label: "Escrow Totals" },
    ],
  },
  {
    title: "Accounts",
    items: [
      { href: "/admin/users", label: "All Users" },
      { href: "/admin/vendors", label: "Sellers" },
      { href: "/admin/notifications", label: "Rider Queue" },
    ],
  },
  {
    title: "Reports & Analytics",
    items: [
      { href: "/admin/dashboard", label: "Dashboard Stats" },
      { href: "/admin/dashboard", label: "Revenue Trends" },
      { href: "/admin/dashboard", label: "Order Snapshot" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/finance", label: "Revenue" },
      { href: "/admin/finance", label: "Pending Amounts" },
      { href: "/admin/finance", label: "Timed-out Amounts" },
    ],
  },
  {
    title: "Catalog Setup",
    items: [
      { href: "/admin/promotions", label: "Brands" },
      { href: "/admin/promotions", label: "Categories" },
      { href: "/admin/promotions", label: "Tags" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/notifications", label: "Expired Uploads" },
      { href: "/admin/settings", label: "Admin Accounts" },
    ],
  },
  {
    title: "Settings",
    items: [{ href: "/admin/settings", label: "Roles & Access" }],
  },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [adminName, setAdminName] = useState("Admin");
  const [adminRole, setAdminRole] = useState("Account");

  useEffect(() => {
    const auth = getAuth();
    const user = auth?.user;
    setAdminName(getDisplayName(user));
    setAdminRole(typeof user?.role === "string" && user.role ? user.role : "Account");
  }, []);

  return (
    <div className="min-h-screen bg-white">
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
                &lt;
              </button>
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-[#f7f8fb] px-4 py-2 text-sm text-slate-500">
                <span aria-hidden="true">Search</span>
                <input
                  className="w-full bg-transparent outline-none"
                  placeholder="Search..."
                />
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>EN</span>
                <span>Theme</span>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs">
                  N
                </div>
                <div className="relative flex h-8 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px]">
                  Msg
                </div>
                <div className="group relative flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-brand/20" />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-800">{adminName}</div>
                    <div className="text-slate-400">{adminRole}</div>
                  </div>
                  <span className="text-slate-400">v</span>
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
