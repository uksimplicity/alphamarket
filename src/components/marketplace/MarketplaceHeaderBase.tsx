"use client";

import type { ReactNode } from "react";
import styles from "@/app/page.module.css";
import { useEffect, useState } from "react";
import { useCartCount } from "@/components/commerce/store";

type LinkComponentProps = {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
};

export type LinkComponent = (props: LinkComponentProps) => JSX.Element;

export default function MarketplaceHeaderBase({
  LinkComponent,
}: {
  LinkComponent: LinkComponent;
}) {
  const cartCount = useCartCount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.headerTop}>
        <LinkComponent className={styles.logo} href="/">
          <img className={styles.logoImage} src="/logo.png" alt="Alpha Marketplace" />
        </LinkComponent>

        <div className={styles.search}>
          <input placeholder="Search products, brands, and categories" />
          <button>Search</button>
        </div>

        <div className={styles.actions}>
          <div className={styles.iconLabel}>
            <button className={styles.iconBtn} aria-label="Alerts">
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
            </button>
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
              {mounted && cartCount > 0 ? (
                <span className={styles.cartBadge}>{cartCount}</span>
              ) : null}
            </LinkComponent>
            <LinkComponent href="/dashboard/cart">Cart</LinkComponent>
          </div>
          <LinkComponent className={styles.signupButton} href="/signup">
            Sign Up
          </LinkComponent>
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
          {mounted && cartCount > 0 ? (
            <span className={styles.cartBadge}>{cartCount}</span>
          ) : null}
        </LinkComponent>
      </div>

      <nav className={styles.categories}>
        <a href="#">All Categories</a>
        <a href="#">Electronics</a>
        <a href="#">Fashion</a>
        <a href="#">Home & Living</a>
        <a href="#">Beauty</a>
        <a href="#">Sports</a>
        <a href="#">Toys</a>
        <a href="#">Automotive</a>
        <a href="#">Books</a>
      </nav>

      <div className={styles.mobileSearchTrigger} aria-hidden="true" />
    </header>
  );
}
