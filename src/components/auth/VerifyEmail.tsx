"use client";

import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function VerifyEmail() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Email Verification"
      subtitle="Enter the verification code sent to your email."
      footer={
        <div className={styles.resend}>
          Didn't receive a code? <Link className={styles.link} to="/verify-email">Resend</Link>
        </div>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          navigate("/email-verified");
        }}
      >
        <input
          className={`${styles.input} ${styles.otpInput}`}
          placeholder="123456"
        />
        <button className={styles.primaryBtn} type="submit">
          Verify Email
        </button>
      </form>
    </AuthLayout>
  );
}
