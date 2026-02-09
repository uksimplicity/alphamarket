"use client";
import EmailVerified from "./auth/EmailVerified";
import ForgotPassword from "./auth/ForgotPassword";
import LoginSelector from "./auth/LoginSelector";
import ResetPassword from "./auth/ResetPassword";
import SignUp from "./auth/SignUp";
import UserLogin from "./auth/UserLogin";
import VendorLogin from "./auth/VendorLogin";
import VerifyEmail from "./auth/VerifyEmail";
import HomeView from "./HomeView";
import VendorDashboard from "./vendor/VendorDashboard";

export default function AppRouter() {
  if (typeof window === "undefined") {
    return null;
  }

  const { BrowserRouter, Navigate, Route, Routes } = require("react-router-dom");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<LoginSelector />} />
        <Route path="/login/user" element={<UserLogin />} />
        <Route path="/login/vendor" element={<VendorLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/email-verified" element={<EmailVerified />} />
        <Route path="/vendor" element={<VendorDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
