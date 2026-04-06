"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { clearAuth, getAuth, getDisplayName, getProfilePath } from "@/components/auth/authStorage";

const navSections = [
  {
    title: "Catalog",
    items: [
      { href: "/admin/products", label: "All Products" },
      { href: "/admin/products/create", label: "Create Product" },
      { href: "/admin/products#product-types", label: "Product Type" },
    ],
  },
  {
    title: "Escrow Management",
    items: [
      { href: "/admin/orders", label: "Pending Escrows" },
      { href: "/admin/orders#timed-out", label: "Timed-out Escrows" },
      { href: "/admin/finance", label: "Revenue Report" },
      { href: "/admin/finance#escrow-totals", label: "Escrow Totals" },
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
      { href: "/admin/dashboard#revenue-trends", label: "Revenue Trends" },
      { href: "/admin/dashboard#order-snapshot", label: "Order Snapshot" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/finance", label: "Revenue" },
      { href: "/admin/commissions", label: "Commissions" },
      { href: "/admin/wallet", label: "Admin Wallet" },
      { href: "/admin/finance#pending-amounts", label: "Pending Amounts" },
      { href: "/admin/finance#timed-out-amounts", label: "Timed-out Amounts" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/deliveries", label: "Deliveries" },
      { href: "/admin/notifications#expired-uploads", label: "Expired Uploads" },
      { href: "/admin/settings", label: "Admin Accounts" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin/settings", label: "Roles & Access" },
      { href: "/admin/platform-settings", label: "Platform Settings" },
    ],
  },
];

const adminSearchAliases = [
  { href: "/admin/dashboard", label: "Overview", keywords: ["home", "stats", "summary"] },
  { href: "/admin/orders", label: "Escrows", keywords: ["escrow", "pending", "release", "reverse"] },
  { href: "/admin/finance", label: "Finance", keywords: ["revenue", "payments", "totals"] },
  {
    href: "/admin/commissions",
    label: "Commissions",
    keywords: ["commission", "mark paid", "rider earnings"],
  },
  { href: "/admin/wallet", label: "Admin Wallet", keywords: ["wallet", "balance", "transactions"] },
  { href: "/admin/deliveries", label: "Deliveries", keywords: ["delivery", "assign rider"] },
  { href: "/admin/vendors", label: "Sellers", keywords: ["vendors", "merchant"] },
  { href: "/admin/users", label: "Users", keywords: ["accounts", "customers"] },
  { href: "/admin/settings", label: "Settings", keywords: ["admin accounts", "roles", "permissions"] },
  {
    href: "/admin/platform-settings",
    label: "Platform Settings",
    keywords: ["config", "upsert", "feature flags"],
  },
];

function resolveAdminSearch(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const sectionMatch = navSections.flatMap((section) =>
    section.items.map((item) => ({
      href: item.href,
      label: item.label,
      section: section.title,
      keywords: [section.title.toLowerCase(), item.href.toLowerCase()],
    }))
  );
  const aliasMatch = adminSearchAliases.map((item) => ({
    href: item.href,
    label: item.label,
    section: "Quick Access",
    keywords: item.keywords,
  }));
  const allEntries = [...sectionMatch, ...aliasMatch];

  const exact = allEntries.find((entry) => {
    const section = entry.section.toLowerCase();
    return (
      entry.label.toLowerCase() === normalized ||
      section === normalized ||
      entry.href.toLowerCase() === normalized
    );
  });
  if (exact) return exact.href;

  const partial = allEntries.find((entry) => {
    const haystacks = [entry.label.toLowerCase(), entry.section.toLowerCase(), entry.href.toLowerCase(), ...entry.keywords];
    return haystacks.some((value) => value.includes(normalized));
  });
  if (partial) return partial.href;

  return null;
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash : ""
  );
  const [authUser] = useState(() => getAuth()?.user ?? null);
  const [{ adminName, adminRole }] = useState(() => {
    const user = getAuth()?.user;
    return {
      adminName: getDisplayName(user),
      adminRole: typeof user?.role === "string" && user.role ? user.role : "Account",
    };
  });
  const [searchText, setSearchText] = useState("");
  const [searchError, setSearchError] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [escrowOpen, setEscrowOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const productsExpanded = productsOpen || pathname.startsWith("/admin/products");
  const catalogExpanded =
    catalogOpen ||
    pathname.startsWith("/admin/promotions") ||
    pathname.startsWith("/admin/categories") ||
    pathname.startsWith("/admin/attributes") ||
    pathname.startsWith("/admin/tags") ||
    pathname.startsWith("/admin/brands");
  const escrowExpanded =
    escrowOpen || pathname.startsWith("/admin/orders") || pathname.startsWith("/admin/finance");
  const accountsExpanded =
    accountsOpen ||
    pathname.startsWith("/admin/users") ||
    pathname.startsWith("/admin/vendors") ||
    pathname.startsWith("/admin/notifications");
  const reportsExpanded = reportsOpen || pathname.startsWith("/admin/dashboard");
  const financeExpanded =
    financeOpen ||
    pathname.startsWith("/admin/finance") ||
    pathname.startsWith("/admin/commissions") ||
    pathname.startsWith("/admin/wallet");
  const operationsExpanded =
    operationsOpen ||
    pathname.startsWith("/admin/deliveries") ||
    pathname.startsWith("/admin/notifications") ||
    pathname.startsWith("/admin/settings");
  const settingsExpanded =
    settingsOpen || pathname.startsWith("/admin/settings") || pathname.startsWith("/admin/platform-settings");

  const isItemActive = (href: string) => {
    const [targetPath, targetHash = ""] = href.split("#");
    if (pathname !== targetPath) {
      return false;
    }
    if (!targetHash) {
      return !currentHash;
    }
    return currentHash === `#${targetHash}`;
  };

  const searchOptions = Array.from(
    new Set([
      ...navSections.flatMap((section) => section.items.map((item) => item.label)),
      ...adminSearchAliases.map((item) => item.label),
    ])
  );

  const profilePath = getProfilePath(authUser);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const destination = resolveAdminSearch(searchText);
    if (!destination) {
      setSearchError("No matching admin section found.");
      return;
    }
    setSearchError("");
    router.push(destination);
  };

  const handleLogout = () => {
    clearAuth();
    setShowLogoutConfirm(false);
    router.push("/login");
  };

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || "");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return (
    <div className="admin-theme min-h-screen bg-[radial-gradient(circle_at_top_left,_#e8efff_0%,_#f8fbff_35%,_#ffffff_75%)]">
      <div
        className={`grid grid-cols-1 gap-6 px-4 py-6 ${
          sidebarCollapsed ? "lg:grid-cols-[0px_1fr]" : "lg:grid-cols-[260px_1fr]"
        }`}
      >
        <aside
          className={`rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/70 via-white to-white p-4 shadow-card transition-all lg:overflow-hidden ${
            sidebarCollapsed ? "pointer-events-none opacity-0 lg:w-0 lg:border-0 lg:p-0" : ""
          }`}
        >
          <div className="mb-6 flex items-center gap-2 font-semibold text-slate-900">
            <img className="h-8" src="/logo.png" alt="Alpha Marketplace" />
            Alpha Marketplace
          </div>
          <Link
            href="/admin/dashboard"
            className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              isItemActive("/admin/dashboard")
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
                      aria-expanded={productsExpanded}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Products
                    </button>
                    {productsExpanded ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = isItemActive(item.href);
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
                      aria-expanded={catalogExpanded}
                      className="mt-1 w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Categories &amp; Attributes
                    </button>
                    {catalogExpanded ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {[
                          { label: "Categories", href: "/admin/categories" },
                          { label: "Attributes", href: "/admin/attributes" },
                          { label: "Tags", href: "/admin/tags" },
                          { label: "Brand", href: "/admin/brands" },
                        ].map((item) => {
                          const active = isItemActive(item.href);
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
                      aria-expanded={escrowExpanded}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Escrow Management
                    </button>
                    {escrowExpanded ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = isItemActive(item.href);
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
                      aria-expanded={accountsExpanded}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Accounts
                    </button>
                    {accountsExpanded ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = isItemActive(item.href);
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
                      aria-expanded={reportsExpanded}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Reports &amp; Analytics
                    </button>
                    {reportsExpanded ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = isItemActive(item.href);
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
                      aria-expanded={financeExpanded}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Finance
                    </button>
                    {financeExpanded ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = isItemActive(item.href);
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
                      aria-expanded={operationsExpanded}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Operations
                    </button>
                    {operationsExpanded ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = isItemActive(item.href);
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
                      aria-expanded={settingsExpanded}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                    >
                      Settings
                    </button>
                    {settingsExpanded ? (
                      <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                        {section.items.map((item) => {
                          const active = isItemActive(item.href);
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
                      const active = isItemActive(item.href);
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
                type="button"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#1b3ea6]"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!sidebarCollapsed}
              >
                {sidebarCollapsed ? ">" : "<"}
              </button>
              <div className="flex min-w-[260px] flex-1 flex-col gap-1">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-2 text-sm text-slate-600"
                >
                  <span aria-hidden="true">Search</span>
                  <input
                    list="admin-search-options"
                    className="w-full bg-transparent outline-none"
                    placeholder="Search admin sections..."
                    value={searchText}
                    onChange={(event) => {
                      setSearchText(event.target.value);
                      if (searchError) {
                        setSearchError("");
                      }
                    }}
                    aria-label="Search admin sections"
                  />
                  <datalist id="admin-search-options">
                    {searchOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  <button
                    type="submit"
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Go
                  </button>
                </form>
                {searchError ? (
                  <div className="px-1 text-xs text-rose-600">{searchError}</div>
                ) : null}
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
                    <Link
                      href={profilePath}
                      className="block w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-600"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(true)}
                      className="w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-600"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {children}
          {showLogoutConfirm ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4">
              <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <h3 className="text-lg font-semibold text-slate-900">Confirm logout</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Are you sure you want to log out?
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
                    onClick={() => setShowLogoutConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

