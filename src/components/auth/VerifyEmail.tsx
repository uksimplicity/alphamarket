"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [email] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem("pendingVerificationEmail") ?? "";
    } catch {
      return "";
    }
  });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resending, setResending] = useState(false);

  return (
    <AuthLayout
      title="Email Verification"
      subtitle="Enter the verification code sent to your email."
      footer={
        <div className={styles.resend}>
          Didn't receive a code?{" "}
          <button
            type="button"
            className={styles.linkButton}
            onClick={async () => {
              if (!email) {
                setError("We couldn't find your email to resend the OTP.");
                return;
              }
              setError("");
              setInfo("");
              try {
                setResending(true);
                const response = await fetch(`/api/auth/resend-verification`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, type: "signup" }),
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
                      : `Resend failed (${response.status}).`;
                  setError(message);
                  return;
                }

                setInfo("OTP resent. Please check your email.");
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Resend failed."
                );
              } finally {
                setResending(false);
              }
            }}
            disabled={resending}
          >
            {resending ? "Resending..." : "Resend"}
          </button>
        </div>
      }
    >
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();

          setError("");
          if (!email || !otp) {
            setError("Please enter your OTP.");
            return;
          }

          try {
            setLoading(true);
            const response = await fetch(`/api/auth/verify-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, otp }),
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
                  : `Verification failed (${response.status}).`;
              setError(message);
              return;
            }

            navigate("/email-verified");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Verification failed.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {!email ? (
          <div className={styles.errorText}>
            We couldn't find your email. Please return to sign up or resend the
            verification code.
          </div>
        ) : null}
        <input
          className={`${styles.input} ${styles.otpInput}`}
          placeholder="123456"
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
        />
        {error ? <div className={styles.errorText}>{error}</div> : null}
        {info ? <div className={styles.successText}>{info}</div> : null}
        <button className={styles.primaryBtn} type="submit">
          {loading ? "Verifying..." : "Verify Email"}
        </button>
      </form>
    </AuthLayout>
  );
}
