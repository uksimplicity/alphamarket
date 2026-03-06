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
import VendorShell from "./vendor/VendorShell";
import VendorProductsAll from "./vendor/pages/VendorProductsAll";
import VendorProductsDraft from "./vendor/pages/VendorProductsDraft";
import VendorProductsStock from "./vendor/pages/VendorProductsStock";
import VendorProductsReview from "./vendor/pages/VendorProductsReview";
import VendorProductsCreate from "./vendor/pages/VendorProductsCreate";
import VendorProductsAddStock from "./vendor/pages/VendorProductsAddStock";
import VendorProductDetail from "./vendor/pages/VendorProductDetail";
import VendorProductEdit from "./vendor/pages/VendorProductEdit";
import ProductDetailRoute from "./products/ProductDetailRoute";
import SellerStoreRoute from "./store/SellerStoreRoute";

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
        <Route path="/products/:productId" element={<ProductDetailRoute />} />
        <Route path="/store/:slug" element={<SellerStoreRoute />} />

        <Route path="/vendor" element={<VendorShell />}>
          <Route index element={<VendorDashboard />} />
          <Route path="products" element={<VendorProductsAll />} />
          <Route path="products/create" element={<VendorProductsCreate />} />
          <Route path="products/draft" element={<VendorProductsDraft />} />
          <Route path="products/stock" element={<VendorProductsStock />} />
          <Route path="products/stock/add" element={<VendorProductsAddStock />} />
          <Route path="products/review" element={<VendorProductsReview />} />
          <Route path="products/:productId" element={<VendorProductDetail />} />
          <Route path="products/:productId/edit" element={<VendorProductEdit />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
