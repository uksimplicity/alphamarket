"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";
import { API_BASE } from "../dashboard/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");

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
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setInfo("");
          if (!email) {
            setError("Please enter your email.");
            return;
          }
          try {
            setLoading(true);
            sessionStorage.setItem("pendingResetEmail", email);
            const response = await fetch(`${API_BASE}/auth/forgot-password`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
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
                  : `Request failed (${response.status}).`;
              setError(message);
              return;
            }

            setInfo("OTP sent. Please check your email.");
          } catch {
            // ignore storage errors
            setError("Request failed.");
            return;
          } finally {
            setLoading(false);
          }
          navigate("/reset-password");
        }}
      >
        <input
          className={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {error ? <div className={styles.errorText}>{error}</div> : null}
        {info ? <div className={styles.successText}>{info}</div> : null}
        <button className={styles.primaryBtn} type="submit">
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </AuthLayout>
  );
}
