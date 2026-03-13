"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";
import { setAuth } from "./authStorage";

export default function UserLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerify, setShowVerify] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendInfo, setResendInfo] = useState("");

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
            const response = await fetch(`/api/auth/login`, {
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

            let role: string | undefined;
            if (
              payload &&
              typeof payload === "object" &&
              "data" in payload &&
              payload.data &&
              typeof payload.data === "object"
            ) {
              const data = payload.data as {
                user?: unknown;
                role?: unknown;
                access_token?: string;
                accessToken?: string;
                token?: string;
                refresh_token?: string;
                token_type?: string;
                expires_in?: number;
              };
              if (data.user && typeof data.user === "object") {
                const userObj = data.user as {
                  role?: unknown;
                  userRole?: unknown;
                  account_role?: unknown;
                };
                role = String(
                  userObj.role ?? userObj.userRole ?? userObj.account_role ?? ""
                );
              }
              const accessToken =
                data.access_token ?? data.accessToken ?? data.token ?? "";
              if (data.user && accessToken) {
                setAuth({
                  user: data.user as Record<string, unknown>,
                  access_token: accessToken,
                  refresh_token: data.refresh_token,
                  token_type: data.token_type,
                  expires_in: data.expires_in,
                });
              }
              if (!role && data.role) {
                role = String(data.role);
              }
            }
            const adminRoles = new Set([
              "admin",
              "marketplace_admin",
              "rider_admin",
              "super_admin",
            ]);
            if (role && adminRoles.has(role)) {
              navigate("/admin");
            } else {
              navigate("/dashboard/home");
            }
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
        <div className={styles.passwordField}>
          <input
            className={`${styles.input} ${styles.inputWithToggle}`}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
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
                  `/api/auth/resend-verification`,
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
