"use client";

import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function VendorLogin() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Vendor Sign In"
      subtitle="Access your vendor dashboard and manage your store."
      footer={
        <div className={styles.footerText}>
          Don't have an account? <Link className={styles.link} to="/signup">Sign Up</Link>
        </div>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          navigate("/vendor");
        }}
      >
        <input className={styles.input} type="email" placeholder="Email" />
        <input className={styles.input} type="password" placeholder="Password" />
        <div className={styles.rowBetween}>
          <span />
          <Link className={styles.link} to="/forgot-password">
            Forgot Password?
          </Link>
        </div>
        <button className={styles.primaryBtn} type="submit">
          Sign In
        </button>
      </form>
    </AuthLayout>
  );
}
