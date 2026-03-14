"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getAuth, getDisplayName } from "@/components/auth/authStorage";

const navSections = [
  {
    title: "Catalog",
    items: [
      { href: "/admin/products", label: "All Products" },
      { href: "/admin/products/create", label: "Create Product" },
    ],
  },
  {
    title: "Escrow Management",
    items: [
      { href: "/admin/orders", label: "Pending Escrows" },
      { href: "/admin/orders", label: "Timed-out Escrows" },
      { href: "/admin/finance", label: "Revenue Report" },
      { href: "/admin/finance", label: "Escrow Totals" },
      { href: "/admin/orders#release-escrow", label: "Release Escrow" },
      { href: "/admin/orders#reverse-escrow", label: "Reverse Escrow" },
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
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [escrowOpen, setEscrowOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const user = auth?.user;
    setAdminName(getDisplayName(user));
    setAdminRole(typeof user?.role === "string" && user.role ? user.role : "Account");
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/admin/products")) {
      setProductsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin/promotions")) {
      setCatalogOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin/orders") || pathname.startsWith("/admin/finance")) {
      setEscrowOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (
      pathname.startsWith("/admin/users") ||
      pathname.startsWith("/admin/vendors") ||
      pathname.startsWith("/admin/notifications")
    ) {
      setAccountsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin/dashboard")) {
      setReportsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin/finance")) {
      setFinanceOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin/notifications") || pathname.startsWith("/admin/settings")) {
      setOperationsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin/settings")) {
      setSettingsOpen(true);
    }
  }, [pathname]);

  return (
    <div className="admin-theme min-h-screen bg-[radial-gradient(circle_at_top_left,_#e8efff_0%,_#f8fbff_35%,_#ffffff_75%)]">
      <div className="grid grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/70 via-white to-white p-4 shadow-card">
          <div className="mb-6 flex items-center gap-2 font-semibold text-slate-900">
            <img className="h-8" src="/logo.png" alt="Alpha Marketplace" />
            Alpha Marketplace
          </div>
          <Link
            href="/admin/dashboard"
            className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              pathname === "/admin/dashboard"
                ? "bg-brand text-white shadow-md shadow-blue-200/60"
                : "text-slate-600 hover:bg-blue-50"
            }`}
          >
            Dashboard
          </Link>
          <nav className="flex flex-col gap-4 text-sm">
            {navSections.map((section) => (
              <div key={section.title}>
                {section.title !== "Escrow Management" &&
                section.title !== "Accounts" &&
                section.title !== "Reports & Analytics" &&
                section.title !== "Finance" &&
                section.title !== "Operations" &&
                section.title !== "Settings" ? (
                  <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {section.title}
                  </div>
                ) : null}
                {section.title === "Catalog" ? (
                  <div className="mt-2 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setProductsOpen((prev) => !prev)}
                      aria-expanded={productsOpen}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Products
                    </button>
                    {productsOpen ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = pathname === item.href.split("#")[0].split("?")[0];
                          return (
                            <Link
                              key={`${section.title}-${item.label}`}
                              href={item.href}
                              className={`relative block py-2 text-sm ${
                                active
                                  ? "font-semibold text-brand"
                                  : "text-slate-600 hover:text-[#1b3ea6]"
                              }`}
                            >
                              <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setCatalogOpen((prev) => !prev)}
                      aria-expanded={catalogOpen}
                      className="mt-1 w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Categories &amp; Attributes
                    </button>
                    {catalogOpen ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {[
                          { label: "Categories", href: "/admin/promotions#categories" },
                          { label: "Attributes", href: "/admin/promotions#attributes" },
                          { label: "Tags", href: "/admin/promotions#tags" },
                          { label: "Brand", href: "/admin/promotions#brand" },
                        ].map((item, index) => {
                          const active = pathname === "/admin/promotions" && index === 0;
                          return (
                            <Link
                              key={`catalog-tree-${item.label}`}
                              href={item.href}
                              className={`relative block py-2 text-sm ${
                                active
                                  ? "font-semibold text-brand"
                                  : "text-slate-600 hover:text-[#1b3ea6]"
                              }`}
                            >
                              <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : section.title === "Escrow Management" ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setEscrowOpen((prev) => !prev)}
                      aria-expanded={escrowOpen}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Escrow Management
                    </button>
                    {escrowOpen ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = pathname === item.href;
                          return (
                            <Link
                              key={`${section.title}-${item.label}`}
                              href={item.href}
                              className={`relative block py-2 text-sm ${
                                active
                                  ? "font-semibold text-brand"
                                  : "text-slate-600 hover:text-[#1b3ea6]"
                              }`}
                            >
                              <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : section.title === "Accounts" ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setAccountsOpen((prev) => !prev)}
                      aria-expanded={accountsOpen}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Accounts
                    </button>
                    {accountsOpen ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = pathname === item.href;
                          return (
                            <Link
                              key={`${section.title}-${item.label}`}
                              href={item.href}
                              className={`relative block py-2 text-sm ${
                                active
                                  ? "font-semibold text-brand"
                                  : "text-slate-600 hover:text-[#1b3ea6]"
                              }`}
                            >
                              <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : section.title === "Reports & Analytics" ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setReportsOpen((prev) => !prev)}
                      aria-expanded={reportsOpen}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Reports &amp; Analytics
                    </button>
                    {reportsOpen ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = pathname === item.href;
                          return (
                            <Link
                              key={`${section.title}-${item.label}`}
                              href={item.href}
                              className={`relative block py-2 text-sm ${
                                active
                                  ? "font-semibold text-brand"
                                  : "text-slate-600 hover:text-[#1b3ea6]"
                              }`}
                            >
                              <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : section.title === "Finance" ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setFinanceOpen((prev) => !prev)}
                      aria-expanded={financeOpen}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Finance
                    </button>
                    {financeOpen ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = pathname === item.href;
                          return (
                            <Link
                              key={`${section.title}-${item.label}`}
                              href={item.href}
                              className={`relative block py-2 text-sm ${
                                active
                                  ? "font-semibold text-brand"
                                  : "text-slate-600 hover:text-[#1b3ea6]"
                              }`}
                            >
                              <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : section.title === "Operations" ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setOperationsOpen((prev) => !prev)}
                      aria-expanded={operationsOpen}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Operations
                    </button>
                    {operationsOpen ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = pathname === item.href;
                          return (
                            <Link
                              key={`${section.title}-${item.label}`}
                              href={item.href}
                              className={`relative block py-2 text-sm ${
                                active
                                  ? "font-semibold text-brand"
                                  : "text-slate-600 hover:text-[#1b3ea6]"
                              }`}
                            >
                              <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : section.title === "Settings" ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setSettingsOpen((prev) => !prev)}
                      aria-expanded={settingsOpen}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Settings
                    </button>
                    {settingsOpen ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = pathname === item.href;
                          return (
                            <Link
                              key={`${section.title}-${item.label}`}
                              href={item.href}
                              className={`relative block py-2 text-sm ${
                                active
                                  ? "font-semibold text-brand"
                                  : "text-slate-600 hover:text-[#1b3ea6]"
                              }`}
                            >
                              <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : (
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
                )}
              </div>
            ))}
          </nav>
        </aside>
        <main className="flex flex-col gap-4">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/70 via-white to-white p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-4">
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#1b3ea6]"
                aria-label="Collapse sidebar"
              >
                &lt;
              </button>
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-2 text-sm text-slate-600">
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
                    <div className="font-semibold text-brand">{adminName}</div>
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

