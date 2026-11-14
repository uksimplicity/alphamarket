"use client";
import { lazy, Suspense, type ReactNode } from "react";
import PagePending from "./PagePending";
const EmailVerified = lazy(() => import("./auth/EmailVerified"));
const ForgotPassword = lazy(() => import("./auth/ForgotPassword"));
const LoginSelector = lazy(() => import("./auth/LoginSelector"));
const ResetPassword = lazy(() => import("./auth/ResetPassword"));
const SignUp = lazy(() => import("./auth/SignUp"));
const UserLogin = lazy(() => import("./auth/UserLogin"));
const VendorLogin = lazy(() => import("./auth/VendorLogin"));
const VerifyEmail = lazy(() => import("./auth/VerifyEmail"));
const HomeView = lazy(() => import("./HomeView"));
const VendorDashboard = lazy(() => import("./vendor/VendorDashboard"));
import VendorShell from "./vendor/VendorShell";
const VendorProductsAll = lazy(() => import("./vendor/pages/VendorProductsAll"));
const VendorProductsDraft = lazy(() => import("./vendor/pages/VendorProductsDraft"));
const VendorProductsStock = lazy(() => import("./vendor/pages/VendorProductsStock"));
const VendorProductsReview = lazy(() => import("./vendor/pages/VendorProductsReview"));
const VendorProductsCreate = lazy(() => import("./vendor/pages/VendorProductsCreate"));
const VendorProductTypes = lazy(() => import("./vendor/pages/VendorProductTypes"));
const VendorProductsAddStock = lazy(() => import("./vendor/pages/VendorProductsAddStock"));
const VendorProductDetail = lazy(() => import("./vendor/pages/VendorProductDetail"));
const VendorProductEdit = lazy(() => import("./vendor/pages/VendorProductEdit"));
const VendorOrders = lazy(() => import("./vendor/pages/VendorOrders"));
const VendorOrderDetail = lazy(() => import("./vendor/pages/VendorOrderDetail"));
const VendorProfile = lazy(() => import("./vendor/pages/VendorProfile"));
const VendorStore = lazy(() => import("./vendor/pages/VendorStore"));
const VendorPayments = lazy(() => import("./vendor/pages/VendorPayments"));
const VendorMyAds = lazy(() => import("./ads/VendorAdsRoutes").then(module => ({ default: module.VendorMyAds })));
const VendorAdDetail = lazy(() => import("./ads/VendorAdsRoutes").then(module => ({ default: module.VendorAdDetail })));
const VendorPostAd = lazy(() => import("./ads/VendorAdsRoutes").then(module => ({ default: module.VendorPostAd })));
const VendorWallet = lazy(() => import("./ads/VendorAdsRoutes").then(module => ({ default: module.VendorWallet })));
const ProductDetailRoute = lazy(() => import("./products/ProductDetailRoute"));
const SellerStoreRoute = lazy(() => import("./store/SellerStoreRoute"));
import SessionBoundary from "./auth/SessionBoundary";
const ChatWorkspace = lazy(() => import("./chat/ChatWorkspace"));
const SavedAddresses = lazy(() => import("./commerce/SavedAddresses"));
const NotificationPreferencesPanel = lazy(() => import("./commerce/NotificationPreferencesPanel"));
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

function page(children: ReactNode) { return <Suspense fallback={<PagePending />}>{children}</Suspense>; }

export default function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true }}>
      <Routes>
        <Route path="/" element={page(<HomeView />)} />
        <Route path="/signup" element={page(<SignUp />)} />
        <Route path="/login" element={page(<LoginSelector />)} />
        <Route path="/login/user" element={page(<UserLogin />)} />
        <Route path="/login/vendor" element={page(<VendorLogin />)} />
        <Route path="/forgot-password" element={page(<ForgotPassword />)} />
        <Route path="/reset-password" element={page(<ResetPassword />)} />
        <Route path="/verify-email" element={page(<VerifyEmail />)} />
        <Route path="/email-verified" element={page(<EmailVerified />)} />
        <Route path="/products/:productId" element={page(<ProductDetailRoute />)} />
        <Route path="/store/:slug" element={page(<SellerStoreRoute />)} />

        <Route path="/vendor" element={<SessionBoundary seller><VendorShell /></SessionBoundary>}>
          <Route index element={page(<VendorDashboard />)} />
          <Route path="products" element={page(<VendorProductsAll />)} />
          <Route path="products/create" element={page(<VendorProductsCreate />)} />
          <Route path="products/types" element={page(<VendorProductTypes />)} />
          <Route path="products/draft" element={page(<VendorProductsDraft />)} />
          <Route path="products/stock" element={page(<VendorProductsStock />)} />
          <Route path="products/stock/add" element={page(<VendorProductsAddStock />)} />
          <Route path="products/review" element={page(<VendorProductsReview />)} />
          <Route path="products/:productId" element={page(<VendorProductDetail />)} />
          <Route path="products/:productId/edit" element={page(<VendorProductEdit />)} />
          <Route path="orders" element={page(<VendorOrders />)} />
          <Route path="orders/:orderId" element={page(<VendorOrderDetail />)} />
          <Route path="store" element={page(<VendorStore />)} />
          <Route path="profile" element={page(<VendorProfile />)} />
          <Route path="payments" element={page(<VendorPayments />)} />
          <Route path="my-ads" element={page(<VendorMyAds />)} />
          <Route path="my-ads/create" element={page(<VendorPostAd />)} />
          <Route path="my-ads/:adId" element={page(<VendorAdDetail />)} />
          <Route path="wallet" element={page(<VendorWallet />)} />
          <Route path="messages" element={page(<ChatWorkspace />)} />
          <Route path="addresses" element={page(<SavedAddresses />)} />
          <Route path="notifications" element={page(<NotificationPreferencesPanel />)} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
