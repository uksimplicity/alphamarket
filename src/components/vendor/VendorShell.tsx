"use client";

import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import styles from "./vendor.module.css";
import { getAuth, getDisplayName } from "@/components/auth/authStorage";

type NavItem = {
  label: string;
  href: string;
};

type VendorProfile = {
  id?: string;
  email?: string;
  phone?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
};

const sellerSections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Products",
    items: [
      { label: "All Products", href: "/vendor/products" },
      { label: "Create Product", href: "/vendor/products/create" },
      { label: "Draft Products", href: "/vendor/products/draft" },
      { label: "Stock Products", href: "/vendor/products/stock" },
      { label: "Add Stock", href: "/vendor/products/stock/add" },
      { label: "Review Queue", href: "/vendor/products/review" },
      { label: "Boost Product", href: "#" },
    ],
  },
  {
    title: "Order Management",
    items: [
      { label: "Orders", href: "/vendor/orders" },
      { label: "Transactions", href: "#" },
    ],
  },
  {
    title: "Reports & Analytics",
    items: [{ label: "Sales Reports", href: "#" }],
  },
  {
    title: "Wallet",
    items: [
      { label: "Earning", href: "#" },
      { label: "Withdraws", href: "#" },
      { label: "Refunds", href: "#" },
      { label: "Escrow", href: "#" },
    ],
  },
  {
    title: "Promotional Deals",
    items: [{ label: "Coupon", href: "#" }],
  },
  {
    title: "Help & Support",
    items: [{ label: "Inbox", href: "#" }],
  },
];

function formatRole(role?: string) {
  if (!role) return "Vendor";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function VendorShell() {
  const { pathname } = useLocation();
  const isDashboard = pathname === "/vendor" || pathname === "/vendor/";
  const [vendorDetails, setVendorDetails] = useState<VendorProfile | null>(() => getAuth()?.user ?? null);
  const [vendorName, setVendorName] = useState(() =>
    getDisplayName(getAuth()?.user)
  );
  const [showSettings, setShowSettings] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(pathname.startsWith("/vendor/products"));
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const roleLabel = useMemo(
    () => formatRole(vendorDetails?.role),
    [vendorDetails?.role]
  );
  const sectionState: Record<string, [boolean, (value: boolean | ((prev: boolean) => boolean)) => void]> = {
    Products: [productsOpen, setProductsOpen],
    "Order Management": [ordersOpen, setOrdersOpen],
    "Reports & Analytics": [reportsOpen, setReportsOpen],
    Wallet: [walletOpen, setWalletOpen],
    "Promotional Deals": [promoOpen, setPromoOpen],
    "Help & Support": [supportOpen, setSupportOpen],
  };

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "alpha.auth") {
        const nextAuth = getAuth();
        setVendorName(getDisplayName(nextAuth?.user));
        setVendorDetails(nextAuth?.user ?? null);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!showSettings) return;
    let canceled = false;

    async function loadProfile() {
      setProfileLoading(true);
      setProfileError("");
      try {
        const auth = getAuth();
        const token = auth?.access_token;
        const response = await fetch("/api/user/profile", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const text = await response.text();
        let payload: unknown = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
          payload = text;
        }

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error: unknown }).error)
              : `Failed to load profile (${response.status}).`;
          throw new Error(message);
        }

        const record =
          payload && typeof payload === "object"
            ? (((payload as Record<string, unknown>).data ??
                (payload as Record<string, unknown>).user ??
                (payload as Record<string, unknown>).profile ??
                payload) as Record<string, unknown>)
            : null;
        if (!record || canceled) return;

        const nextDetails: VendorProfile = {
          id: String(record.id ?? record.user_id ?? auth?.user?.id ?? ""),
          email: String(record.email ?? auth?.user?.email ?? ""),
          phone: String(record.phone ?? auth?.user?.phone ?? ""),
          role: String(record.role ?? auth?.user?.role ?? "seller"),
          first_name: String(record.first_name ?? auth?.user?.first_name ?? ""),
          last_name: String(record.last_name ?? auth?.user?.last_name ?? ""),
        };

        setVendorDetails(nextDetails);
        setVendorName((prev) => getDisplayName(nextDetails) || prev);
      } catch (err) {
        if (!canceled) {
          setProfileError(
            err instanceof Error
              ? err.message
              : "Could not fetch profile details from backend."
          );
        }
      } finally {
        if (!canceled) setProfileLoading(false);
      }
    }

    void loadProfile();
    return () => {
      canceled = true;
    };
  }, [showSettings, vendorName]);

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className="mb-6 flex items-center gap-2 px-2 font-semibold text-slate-900">
          <img className="h-8" src="/logo.png" alt="Alpha Marketplace" />
          Alpha Marketplace
        </div>
        <div className="mb-4">
          <Link
            to="/vendor"
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              isDashboard
                ? "bg-brand text-white shadow-md shadow-blue-200/60"
                : "text-slate-600 hover:bg-blue-50"
            }`}
          >
            Dashboard
          </Link>
        </div>

        <nav className="flex flex-col gap-4 text-sm">
          {sellerSections.map((section) => {
            const [isOpen, setOpen] = sectionState[section.title];
            const sectionActive = section.items.some(
              (item) => item.href !== "#" && pathname.startsWith(item.href)
            );

            return (
              <div key={section.title}>
                <button
                  type="button"
                  onClick={() => setOpen((prev) => !prev)}
                  aria-expanded={isOpen}
                  className="w-full rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2 text-left text-sm font-semibold text-[#1b3ea6] transition hover:bg-blue-100/70"
                >
                  {section.title}
                </button>
                {isOpen ? (
                  <div className="relative ml-4 mt-2 border-l border-blue-200 pl-5">
                    {section.items.map((item) => {
                      const active = item.href !== "#" && pathname.startsWith(item.href);
                      const sharedClass = `relative block py-2 text-sm ${
                        active ? "font-semibold text-brand" : "text-slate-600 hover:text-[#1b3ea6]"
                      }`;

                      if (item.href === "#") {
                        return (
                          <button
                            key={`${section.title}-${item.label}`}
                            type="button"
                            className={`${sharedClass} w-full cursor-not-allowed text-left opacity-70`}
                            disabled
                          >
                            <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                            {item.label}
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={`${section.title}-${item.label}`}
                          to={item.href}
                          className={sharedClass}
                        >
                          <span className="absolute -left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand/70" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
                {sectionActive && !isOpen ? (
                  <div className="mt-2 px-3 text-xs text-brand">Active section</div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Account</div>
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={() => setShowSettings(true)}
          >
            Profile
          </button>
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={() => setShowSettings(true)}
          >
            Settings
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topLeft}>
            <button className={styles.collapseBtn} aria-label="Collapse sidebar">
              <span>{"<"}</span>
            </button>
            <div className={styles.search}>
              <span>Search</span>
              <input aria-label="Search" placeholder="Search..." />
            </div>
          </div>
          <div className={styles.topActions}>
            <Link to="/vendor/products/create" className={styles.sellButton}>
              Sell
            </Link>
            <div
              className={`${styles.profile} ${styles.profileMenu} ${
                profileOpen ? styles.profileMenuOpen : ""
              }`}
              onClick={() => setProfileOpen((prev) => !prev)}
            >
              <div className={styles.avatar} />
              <div className={styles.profileMeta}>
                <span className={styles.profileName}>
                  {vendorName || "Vendor"}
                </span>
                <span className={styles.profileRole}>{roleLabel}</span>
              </div>
              <span className={styles.caret}>v</span>
              <div className={styles.profileDropdown}>
                <button
                  type="button"
                  className={styles.profileItem}
                  onClick={() => {
                    setProfileOpen(false);
                    setShowSettings(true);
                  }}
                >
                  Profile
                </button>
                <Link className={styles.profileItem} to="/login">
                  Logout
                </Link>
              </div>
            </div>
          </div>
        </div>

        <Outlet />
      </main>

      <nav className={styles.mobileNav} aria-label="Vendor mobile navigation">
        <Link
          className={`${styles.mobileNavItem} ${styles.mobileNavItemActive}`}
          to="/vendor"
        >
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 10l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-9z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Home
        </Link>
        <Link className={styles.mobileNavItem} to="/vendor/orders">
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h16M4 12h16M4 18h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Orders
        </Link>
        <Link className={styles.mobileNavItem} to="/vendor/products">
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 7h16v10H4V7zm3-3h10v3H7V4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Products
        </Link>
        <button className={styles.mobileNavItem} type="button">
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h16v12H4V6zm0 0l8 6 8-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Inbox
        </button>
        <button className={styles.mobileNavItem} type="button">
          <span className={styles.mobileNavIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle
                cx="12"
                cy="8"
                r="4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M4 20c1.8-4 13.2-4 16 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Account
        </button>
      </nav>
      {showSettings ? (
        <div className={styles.settingsModal}>
          <div className={styles.settingsCard}>
            <h3>Account settings</h3>
            <p>Review your account details and manage security.</p>
            {profileLoading ? (
              <p className={styles.cardSubtitle}>Loading latest profile from backend...</p>
            ) : null}
            {profileError ? (
              <p className={styles.cardSubtitle}>{profileError}</p>
            ) : null}
            <div className={styles.settingsList}>
              <div className={styles.settingsRow}>
                <span className={styles.settingsLabel}>User ID</span>
                <span className={styles.settingsValue}>{vendorDetails?.id ?? "-"}</span>
              </div>
              <div className={styles.settingsRow}>
                <span className={styles.settingsLabel}>Name</span>
                <span className={styles.settingsValue}>{vendorName || "Vendor"}</span>
              </div>
              <div className={styles.settingsRow}>
                <span className={styles.settingsLabel}>Email</span>
                <span className={styles.settingsValue}>{vendorDetails?.email ?? "-"}</span>
              </div>
              <div className={styles.settingsRow}>
                <span className={styles.settingsLabel}>Phone</span>
                <span className={styles.settingsValue}>{vendorDetails?.phone ?? "-"}</span>
              </div>
              <div className={styles.settingsRow}>
                <span className={styles.settingsLabel}>Role</span>
                <span className={styles.settingsValue}>{roleLabel}</span>
              </div>
            </div>
            <div className={styles.settingsActions}>
              <button
                type="button"
                className={styles.settingsSecondary}
                onClick={() => setShowSettings(false)}
              >
                Close
              </button>
              <button
                type="button"
                className={styles.settingsPrimary}
                onClick={() => {
                  if (vendorDetails?.email) {
                    try {
                      sessionStorage.setItem("pendingResetEmail", vendorDetails.email);
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
