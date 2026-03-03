"use client";

import { Link, Outlet, useLocation } from "react-router-dom";
import ManageProductMenu from "@/components/sidebar/ManageProductMenu";
import styles from "./vendor.module.css";

export default function VendorShell() {
  const { pathname } = useLocation();
  const isDashboard = pathname === "/vendor" || pathname === "/vendor/";

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="Alpha Marketplace" />
        </div>
        <div className={styles.navGroup}>
          <Link
            to="/vendor"
            className={`${styles.navItem} ${isDashboard ? styles.navItemActive : ""}`}
          >
            Dashboard
          </Link>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Product Management</div>
          <ManageProductMenu />
          <div className={styles.navItem}>Categories & Attributes</div>
          <div className={styles.navItem}>Manage Inventory</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Order Management</div>
          <div className={styles.navItem}>Orders</div>
          <div className={styles.navItem}>Transactions</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>User Management</div>
          <div className={styles.navItem}>Staff User</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Reports & Analytics</div>
          <div className={styles.navItem}>Sales reports</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Finance Management</div>
          <div className={styles.navItem}>Earning</div>
          <div className={styles.navItem}>Withdraws</div>
          <div className={styles.navItem}>Refunds</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Promotional Deals</div>
          <div className={styles.navItem}>Coupon</div>
        </div>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Help & Support</div>
          <div className={styles.navItem}>Inbox</div>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topLeft}>
            <button className={styles.collapseBtn} aria-label="Collapse sidebar">
              <span>‹</span>
            </button>
            <div className={styles.search}>
              <span>🔍</span>
              <input aria-label="Search" placeholder="Search..." />
            </div>
          </div>
          <div className={styles.topActions}>
            <span>🇬🇧</span>
            <div className={styles.actionIcon}>
              🔔
              <span className={styles.badge}>5</span>
            </div>
            <div className={styles.actionIcon}>
              ✉️
              <span className={styles.badge}>8</span>
            </div>
            <div className={`${styles.profile} ${styles.profileMenu}`}>
              <div className={styles.avatar} />
              <div className={styles.profileMeta}>
                <span className={styles.profileName}>Jacob</span>
                <span className={styles.profileRole}>Vendor</span>
              </div>
              <span className={styles.caret}>▾</span>
              <div className={styles.profileDropdown}>
                <button className={styles.profileItem}>Profile</button>
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
        <button className={styles.mobileNavItem} type="button">
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
        </button>
        <button className={styles.mobileNavItem} type="button">
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
        </button>
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
    </div>
  );
}
