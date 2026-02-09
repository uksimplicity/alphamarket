"use client";

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import HomeView from "../HomeView";
import styles from "./auth.module.css";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  backHref?: string;
};

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  backHref = "/",
}: AuthLayoutProps) {
  return (
    <div className={styles.authPage}>
      <div className={styles.homeBackdrop} aria-hidden="true">
        <HomeView mode="background" />
      </div>
      <div className={styles.backdrop} />
      <div className={styles.card}>
        <Link className={styles.backLink} to={backHref}>
          Back
        </Link>
        <div className={styles.brand}>
          <img src="/logo.png" alt="Alpha Marketplace" />
        </div>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}
