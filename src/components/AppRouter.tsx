"use client";

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import EmailVerified from "./auth/EmailVerified";
import ForgotPassword from "./auth/ForgotPassword";
import Login from "./auth/Login";
import ResetPassword from "./auth/ResetPassword";
import SignUp from "./auth/SignUp";
import VerifyEmail from "./auth/VerifyEmail";
import HomeView from "./HomeView";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/email-verified" element={<EmailVerified />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
