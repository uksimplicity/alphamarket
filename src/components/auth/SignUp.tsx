"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import styles from "./auth.module.css";

export default function SignUp() {
  const [role, setRole] = useState<"user" | "vendor">("user");
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!firstName || !lastName || !email || !phone || !password) {
      setError("Please fill in all required fields.");
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

    if (!acceptedTerms) {
      setError("Please accept the terms and conditions.");
      return;
    }

    const apiRole = role === "user" ? "buyer" : "seller";

    try {
      setLoading(true);
      const response = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          password,
          phone,
          role: apiRole,
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
            : `Registration failed (${response.status}).`;
        setError(message);
        return;
      }

      try {
        sessionStorage.setItem("pendingVerificationEmail", email);
      } catch {
        // Ignore storage errors (private mode, disabled storage, etc.)
      }
      setSuccess("Account created. Please verify your email.");
      navigate("/verify-email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

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
          Buyer
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${
            role === "vendor" ? styles.toggleActive : ""
          }`}
          onClick={() => setRole("vendor")}
        >
          Seller
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          placeholder="First name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Last name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
        <input
          className={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
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
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          I accept Terms and Condition
        </label>
        {error ? <div className={styles.errorText}>{error}</div> : null}
        {success ? <div className={styles.successText}>{success}</div> : null}
        <button className={styles.primaryBtn} type="submit">
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
    </AuthLayout>
  );
}
