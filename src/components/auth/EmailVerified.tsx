"use client";

import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function EmailVerified() {
  return (
    <AuthLayout
      title="Email Verified"
      subtitle="Your email has been verified successfully."
      footer={
        <div className={styles.footerText}>
          Continue to <Link className={styles.link} to="/login">Login</Link>
        </div>
      }
    >
      <div className={styles.form}>
        <Link className={styles.primaryBtn} to="/login">
          Go to Login
        </Link>
      </div>
    </AuthLayout>
  );
}
