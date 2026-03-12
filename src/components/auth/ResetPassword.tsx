"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem("pendingResetEmail") ?? "";
    } catch {
      return "";
    }
  });
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  function isStrongPassword(value: string) {
    return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
  }

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Set a new password to secure your account."
      footer={
        <div className={styles.footerText}>
          Back to <Link className={styles.link} to="/login">Login</Link>
        </div>
      }
    >
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSuccess("");

          if (!email) {
            setError("We couldn't find your email. Please start again.");
            return;
          }
          if (!otp || !password) {
            setError("Please enter your OTP and new password.");
            return;
          }
    if (!isStrongPassword(password)) {
      setError("Please meet all password requirements.");
      return;
    }
          if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
          }

          const otpNumber = Number.parseInt(otp, 10);
          if (Number.isNaN(otpNumber)) {
            setError("OTP must be a number.");
            return;
          }

          try {
            setLoading(true);
            const response = await fetch(`/api/auth/reset-password`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email,
                new_password: password,
                otp: otpNumber,
              }),
            });

            const text = await response.text();
            let payload: unknown = null;
            try {
              payload = text ? JSON.parse(text) : null;
            } catch {
              payload = text;
            }

            if (!response.ok) {
              const message =
                typeof payload === "object" && payload && "error" in payload
                  ? String((payload as { error: unknown }).error)
                  : `Reset failed (${response.status}).`;
              setError(message);
              return;
            }

            setSuccess("Password updated. Please sign in.");
            setTimeout(() => navigate("/login"), 800);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Reset failed.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {!email ? (
          <div className={styles.errorText}>
            We couldn't find your email. Please start again.
          </div>
        ) : null}
        <input
          className={styles.input}
          placeholder="OTP code"
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
        />
        <div className={styles.passwordField}>
          <input
            className={`${styles.input} ${styles.inputWithToggle}`}
            type={showPassword ? "text" : "password"}
            placeholder="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                <path
                  d="M4 4l16 16M9.5 9.5a3 3 0 0 0 4.2 4.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M3 12s3.5-6 9-6 9 6 9 6-1.6 2.8-4.2 4.6M8.2 14.8C6.1 13.4 4.8 12 4.8 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                <path
                  d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
          </button>
        </div>
        <div className={styles.criteriaList}>
          <span className={criteria.length ? styles.criteriaGood : styles.criteriaBad}>
            At least 8 characters
          </span>
          <span className={criteria.uppercase ? styles.criteriaGood : styles.criteriaBad}>
            At least 1 uppercase letter
          </span>
          <span className={criteria.number ? styles.criteriaGood : styles.criteriaBad}>
            At least 1 number
          </span>
          <span className={criteria.special ? styles.criteriaGood : styles.criteriaBad}>
            At least 1 special character
          </span>
        </div>
        <div className={styles.passwordField}>
          <input
            className={`${styles.input} ${styles.inputWithToggle}`}
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            onClick={() => setShowConfirmPassword((prev) => !prev)}
          >
            {showConfirmPassword ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                <path
                  d="M4 4l16 16M9.5 9.5a3 3 0 0 0 4.2 4.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M3 12s3.5-6 9-6 9 6 9 6-1.6 2.8-4.2 4.6M8.2 14.8C6.1 13.4 4.8 12 4.8 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                <path
                  d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
          </button>
        </div>
        {confirmPassword ? (
          <div
            className={`${styles.matchText} ${
              password === confirmPassword ? styles.criteriaGood : styles.criteriaBad
            }`}
          >
            {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
          </div>
        ) : null}
        {error ? <div className={styles.errorText}>{error}</div> : null}
        {success ? <div className={styles.successText}>{success}</div> : null}
        <button className={styles.primaryBtn} type="submit">
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </AuthLayout>
  );
}
