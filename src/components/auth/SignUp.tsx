"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function SignUp() {
  const [role, setRole] = useState<"user" | "vendor">("user");
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Sign Up"
      subtitle="First time on our platform? Sign up it's quick and easy."
      footer={
        <div className={styles.footerText}>
          Already have an account? <Link className={styles.link} to="/login">Sign In</Link>
        </div>
      }
    >
      <div className={styles.toggleGroup}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${
            role === "user" ? styles.toggleActive : ""
          }`}
          onClick={() => setRole("user")}
        >
          User
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${
            role === "vendor" ? styles.toggleActive : ""
          }`}
          onClick={() => setRole("vendor")}
        >
          Vendor
        </button>
      </div>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          navigate("/verify-email");
        }}
      >
        <input className={styles.input} placeholder="Name" />
        <input className={styles.input} type="email" placeholder="Email" />
        <input className={styles.input} type="password" placeholder="Password" />
        <input
          className={styles.input}
          type="password"
          placeholder="Confirm password"
        />
        <label className={styles.checkboxRow}>
          <input type="checkbox" />
          I accept Terms and Condition
        </label>
        <button className={styles.primaryBtn} type="submit">
          Sign Up
        </button>
      </form>
    </AuthLayout>
  );
}
