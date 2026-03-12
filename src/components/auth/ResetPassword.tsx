"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";
import { API_BASE } from "../dashboard/api";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
            const response = await fetch(`${API_BASE}/auth/reset-password`, {
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
        <input
          className={styles.input}
          type="password"
          placeholder="New password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        {error ? <div className={styles.errorText}>{error}</div> : null}
        {success ? <div className={styles.successText}>{success}</div> : null}
        <button className={styles.primaryBtn} type="submit">
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </AuthLayout>
  );
}
