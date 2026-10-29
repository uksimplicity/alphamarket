"use client";

import type { ReactElement, ReactNode } from "react";
import styles from "@/app/page.module.css";
import MarketplaceSearch from "@/components/marketplace/MarketplaceSearch";
import { useEffect, useRef, useState } from "react";
import { useCartCount } from "@/components/commerce/store";
import {
  clearAuth,
  getDashboardPath,
  getDisplayName,
  getProfilePath,
} from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { useAdminCategoryNames } from "@/components/marketplace/useAdminCategoryNames";

type LinkComponentProps = {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
};

export type LinkComponent = (props: LinkComponentProps) => ReactElement;

export default function MarketplaceHeaderBase({
  LinkComponent,
}: {
  LinkComponent: LinkComponent;
}) {
  const cartCount = useCartCount();
  const authUser = useAuthUser();
  const user = authUser;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const userName = getDisplayName(user);
  const adminCategoryNames = useAdminCategoryNames();

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountRef.current?.contains(event.target)) setUserMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        <LinkComponent className={styles.logo} href="/">
          <img className={styles.logoImage} src="/logo.png" alt="Alpha Marketplace" />
        </LinkComponent>

        <MarketplaceSearch />

        <div className={styles.actions}>
          <div className={styles.iconLabel}>
            <LinkComponent className={styles.iconBtn} aria-label="Alerts" href="/dashboard/notifications">
              <svg viewBox="0 0 24 24" aria-hidden="true">
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
            </LinkComponent>
            Alerts
          </div>
          <div className={styles.iconLabel}>
            <LinkComponent className={styles.iconBtn} aria-label="Orders" href="/dashboard/orders">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h16M4 12h16M4 18h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </LinkComponent>
            Orders
          </div>
          <div className={styles.iconLabel}>
            <LinkComponent
              className={styles.iconBtn}
              aria-label="Cart"
              href="/dashboard/cart"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
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
                <span className={styles.cartBadge}>{cartCount}</span>
              ) : null}
            </LinkComponent>
            <LinkComponent href="/dashboard/cart">Cart</LinkComponent>
          </div>
          {userName ? (
            <div className={styles.iconLabel} ref={accountRef}>
              <button
                type="button"
                className={styles.userMenuTrigger}
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
              >
                <span className={styles.userName}>{userName}</span>
                <span className={styles.userCaret}>˅</span>
              </button>
              <div
                className={`${styles.userDropdown} ${
                  userMenuOpen ? styles.userDropdownOpen : ""
                }`}
              >
                <LinkComponent href={getDashboardPath(user)}>
                  <span className={styles.dropdownIcon}>•</span>
                  Dashboard
                </LinkComponent>
                <LinkComponent href={getProfilePath(user)}>
                  <span className={styles.dropdownIcon}>•</span>
                  Profile
                </LinkComponent>
                <button
                  type="button"
                  className={styles.accountItem}
                  onClick={() => {
                    clearAuth();
                    setUserMenuOpen(false);
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.iconLabel}>
              <LinkComponent className={styles.iconBtn} aria-label="Login" href="/login">
                <svg viewBox="0 0 24 24" aria-hidden="true">
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
                    strokeLinecap="round"
                  />
                </svg>
              </LinkComponent>
              <LinkComponent href="/login">Login</LinkComponent>
            </div>
          )}
          {userName ? null : (
            <LinkComponent className={styles.signupButton} href="/signup">
              Sign Up
            </LinkComponent>
          )}
        </div>

        <LinkComponent className={styles.mobileCartButton} aria-label="Cart" href="/dashboard/cart">
          <svg viewBox="0 0 24 24" aria-hidden="true">
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
            <span className={styles.cartBadge}>{cartCount}</span>
          ) : null}
        </LinkComponent>
      </div>

      <nav className={styles.categories}>
        <a href="/#browse-listings">All Categories</a>
        {adminCategoryNames.map((name) => (
          <a key={name} href={`/?category=${encodeURIComponent(name.toLowerCase())}#browse-listings`}>
            {name}
          </a>
        ))}
      </nav>

      <div className={styles.mobileSearchTrigger} aria-hidden="true" />
    </header>
  );
}
