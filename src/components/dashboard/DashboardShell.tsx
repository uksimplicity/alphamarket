"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard/home", label: "Home" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/wishlist", label: "Wishlist" },
  { href: "/dashboard/cart", label: "Cart" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/support", label: "Support" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/dashboard/home") {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-24 pt-6 lg:grid-cols-[240px_1fr] lg:pb-6">
        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-card lg:block">
          <div className="mb-6 flex items-center gap-2 font-semibold text-slate-900">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
              A
            </span>
            Alpha Dashboard
          </div>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex flex-col gap-6">{children}</main>
      </div>

      <nav className="fixed bottom-4 left-4 right-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-card backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-500">
          {navItems.filter((item) => ["/dashboard/home", "/dashboard/orders", "/dashboard/wishlist", "/dashboard/profile"].includes(item.href)).map((item) => {
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
