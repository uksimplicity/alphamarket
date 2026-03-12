"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";
import { API_BASE } from "../dashboard/api";
import { setAuth } from "./authStorage";

export default function VendorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerify, setShowVerify] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendInfo, setResendInfo] = useState("");

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
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setShowVerify(false);
          setResendInfo("");

          if (!email || !password) {
            setError("Please enter your email and password.");
            return;
          }

          try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/auth/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
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
                  : `Login failed (${response.status}).`;
              setError(message);
              if (message.toLowerCase().includes("unverified")) {
                setShowVerify(true);
                try {
                  sessionStorage.setItem("pendingVerificationEmail", email);
                } catch {
                  // ignore storage errors
                }
              }
              return;
            }

            if (
              payload &&
              typeof payload === "object" &&
              "data" in payload &&
              payload.data &&
              typeof payload.data === "object"
            ) {
              const data = payload.data as {
                user?: unknown;
                access_token?: string;
                refresh_token?: string;
                token_type?: string;
                expires_in?: number;
              };
              if (data.user && data.access_token) {
                setAuth({
                  user: data.user as Record<string, unknown>,
                  access_token: data.access_token,
                  refresh_token: data.refresh_token,
                  token_type: data.token_type,
                  expires_in: data.expires_in,
                });
              }
            }
            navigate("/vendor");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <input
          className={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className={styles.rowBetween}>
          <span />
          <Link className={styles.link} to="/forgot-password">
            Forgot Password?
          </Link>
        </div>
        {error ? <div className={styles.errorText}>{error}</div> : null}
        {showVerify ? (
          <button
            type="button"
            className={styles.verifyNowBtn}
            disabled={resendLoading}
            onClick={async () => {
              if (!email) return;
              setResendInfo("");
              setError("");
              try {
                setResendLoading(true);
                const response = await fetch(
                  `${API_BASE}/auth/resend-verification`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, type: "signup" }),
                  }
                );

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
                      : `Resend failed (${response.status}).`;
                  setError(message);
                  return;
                }

                setResendInfo("Verification code resent. Check your email.");
                setTimeout(() => {
                  navigate("/verify-email");
                }, 800);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Resend failed."
                );
              } finally {
                setResendLoading(false);
              }
            }}
          >
            {resendLoading ? "Resending..." : "Verify Now"}
          </button>
        ) : null}
        {resendInfo ? <div className={styles.successText}>{resendInfo}</div> : null}
        <button className={styles.primaryBtn} type="submit">
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </AuthLayout>
  );
}
