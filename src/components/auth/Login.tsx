"use client";

import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function Login() {
  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to continue shopping and manage your account."
      footer={
        <div className={styles.footerText}>
          Don't have an account? <Link className={styles.link} to="/signup">Sign Up</Link>
        </div>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => event.preventDefault()}
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
