"use client";

import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function ForgotPassword() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your email and we'll send a reset link."
      footer={
        <div className={styles.footerText}>
          Back to <Link className={styles.link} to="/login">Login</Link>
        </div>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          navigate("/reset-password");
        }}
      >
        <input className={styles.input} type="email" placeholder="Email" />
        <button className={styles.primaryBtn} type="submit">
          Send Reset Link
        </button>
      </form>
    </AuthLayout>
  );
}
