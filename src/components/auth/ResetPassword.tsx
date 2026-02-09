"use client";

import { useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function ResetPassword() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Set a new password to secure your account."
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          navigate("/login");
        }}
      >
        <input
          className={styles.input}
          type="password"
          placeholder="New password"
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Confirm password"
        />
        <button className={styles.primaryBtn} type="submit">
          Reset Password
        </button>
      </form>
    </AuthLayout>
  );
}
