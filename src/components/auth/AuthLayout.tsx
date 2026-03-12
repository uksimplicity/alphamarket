"use client";

import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  return (
    <div className={styles.authPage}>
      <div className={styles.homeBackdrop} aria-hidden="true">
        <HomeView mode="background" />
      </div>
      <div className={styles.backdrop} />
      <div className={styles.card}>
        <button
          type="button"
          className={styles.backLink}
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate(backHref);
            }
          }}
        >
          Back
        </button>
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
