"use client";

import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function LoginSelector() {
  return (
    <AuthLayout
      title="Sign In"
      subtitle="Choose how you want to access your account."
      footer={
        <div className={styles.footerText}>
          Don't have an account? <Link className={styles.link} to="/signup">Sign Up</Link>
        </div>
      }
    >
      <div className={styles.form}>
        <Link className={styles.primaryBtn} to="/login/user">
          Sign In as User
        </Link>
        <Link className={styles.primaryBtn} to="/login/vendor">
          Sign In as Vendor
        </Link>
      </div>
    </AuthLayout>
  );
}
