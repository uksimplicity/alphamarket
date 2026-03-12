"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { clearAuth, getAuth, getDisplayName } from "@/components/auth/authStorage";
import { useCartCount } from "@/components/commerce/store";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import styles from "@/app/page.module.css";

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
  const [userName, setUserName] = useState("");
  const [userDetails, setUserDetails] = useState<{
    email?: string;
    phone?: string;
    role?: string;
    first_name?: string;
    last_name?: string;
  } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const cartCount = useCartCount();

  useEffect(() => {
    const auth = getAuth();
    setUserName(getDisplayName(auth?.user));
    setUserDetails(auth?.user ?? null);

    function onStorage(e: StorageEvent) {
      if (e.key === "alpha.auth") {
        const nextAuth = getAuth();
        setUserName(getDisplayName(nextAuth?.user));
        setUserDetails(nextAuth?.user ?? null);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (pathname === "/dashboard/home") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-50 pb-24 lg:pb-0">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
          <div className="absolute right-[-120px] top-24 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute bottom-[-160px] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-200/30 blur-3xl" />
        </div>
        {children}
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute right-[-120px] top-24 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-[-160px] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-200/30 blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-24 pt-6 lg:grid-cols-[240px_1fr] lg:pb-6">
        <aside className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:block">
          <div className="px-5 pt-5">
            <Link href="/" className="inline-flex items-center">
              <img src="/logo.png" alt="Alpha Marketplace" className="h-9 w-auto" />
            </Link>
          </div>
          <Link
            href="/"
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
            {userName || profile?.name || "My Alpha Account"}
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
            <button
              type="button"
              className="mx-5 mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </button>
          </nav>
        </aside>
        <main className="flex flex-col gap-6">
          <header className="sticky top-4 z-10 rounded-2xl border border-slate-200 bg-white/95 px-6 py-4 shadow-card backdrop-blur">
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
                <Link
                  href="/dashboard/notifications"
                  className={`flex flex-col items-center gap-1 ${
                    pathname === "/dashboard/notifications" ? "text-brand" : ""
                  }`}
                  aria-current={pathname === "/dashboard/notifications" ? "page" : undefined}
                >
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
                </Link>
                <Link
                  href="/dashboard/orders"
                  className={`flex flex-col items-center gap-1 ${
                    pathname === "/dashboard/orders" ? "text-brand" : ""
                  }`}
                  aria-current={pathname === "/dashboard/orders" ? "page" : undefined}
                >
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
                </Link>
                <Link
                  href="/dashboard/cart"
                  className={`flex flex-col items-center gap-1 ${
                    pathname === "/dashboard/cart" ? "text-brand" : ""
                  }`}
                  aria-current={pathname === "/dashboard/cart" ? "page" : undefined}
                >
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
                    {cartCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
                        {cartCount}
                      </span>
                    ) : null}
                  </span>
                  Cart
                </Link>
                <div className="relative">
                  <button
                    className="flex items-center gap-2"
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    aria-expanded={userMenuOpen}
                  >
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
                      {userName || profile?.name || "My Account"}
                    </span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[10px] text-slate-500">
                      ▾
                    </span>
                  </button>
                  <div
                    className={`absolute right-0 top-12 z-20 w-40 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card ${
                      userMenuOpen
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0"
                    }`}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerColumn}>
            <div className={styles.footerTitle}>About Us</div>
            <div className={styles.footerList}>
              <div>About Alpha Marketplace</div>
              <div>Privacy Policy</div>
              <div>Terms & Conditions</div>
              <div>Our Blog</div>
              <div>Escrow T&C</div>
            </div>
          </div>
          <div className={styles.footerColumn}>
            <div className={styles.footerTitle}>Help</div>
            <div className={styles.footerList}>
              <div>FAQs</div>
              <div>support@alphamarket.ng</div>
              <div>Contact Us</div>
              <div>+234 812 345 6789</div>
            </div>
          </div>
          <div className={styles.footerColumn}>
            <div className={styles.footerTitle}>Resources</div>
            <div className={styles.footerList}>
              <div>Pricing and Fees</div>
              <div>Paid Plans</div>
              <div>Boost Product</div>
              <div>Escrow on Alpha</div>
            </div>
          </div>
          <div className={styles.footerColumn}>
            <div className={styles.footerTitle}>Ads Region</div>
            <div className={styles.footerList}>
              <div>Lagos</div>
              <div>Rivers</div>
              <div>Oyo</div>
              <div>Ogun</div>
              <div>Abuja</div>
            </div>
          </div>
          <div className={styles.footerApps}>
            <div className={styles.footerTitle}>Download our Mobile app</div>
            <div className={styles.footerAppButtons}>
              <button className={styles.footerBadge} type="button">
                <span className={styles.footerBadgeTop}>Get it on</span>
                <span className={styles.footerBadgeMain}>Google Play</span>
              </button>
              <button className={styles.footerBadgePrimary} type="button">
                <span className={styles.footerBadgeTop}>Download on the</span>
                <span className={styles.footerBadgeMain}>App Store</span>
              </button>
            </div>
            <div className={styles.footerSocialTitle}>Stay Connected</div>
            <div className={styles.footerSocialRow}>
              <span>ig</span>
              <span>x</span>
              <span>in</span>
              <span>fb</span>
              <span>yt</span>
            </div>
          </div>
        </div>
        <div className={styles.footerDivider} />
        <div className={styles.footerCopyright}>
          Alpha Market Place © 2026. All rights reserved.
        </div>
      </footer>

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
                onClick={() => {
                  clearAuth();
                  setShowLogoutConfirm(false);
                  window.location.href = "/login";
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showSettings ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="text-lg font-semibold text-slate-900">Account settings</h3>
            <p className="mt-1 text-sm text-slate-600">
              Review your account details and manage security.
            </p>
            <div className="mt-5 grid gap-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Name</span>
                <span>
                  {userName || "My Account"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Email</span>
                <span>{userDetails?.email ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Phone</span>
                <span>{userDetails?.phone ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Role</span>
                <span>{userDetails?.role ?? "-"}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
                onClick={() => setShowSettings(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  if (userDetails?.email) {
                    try {
                      sessionStorage.setItem("pendingResetEmail", userDetails.email);
                    } catch {
                      // ignore storage errors
                    }
                  }
                  window.location.href = "/forgot-password";
                }}
              >
                Reset password
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
