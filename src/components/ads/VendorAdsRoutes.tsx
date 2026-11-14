"use client";
import { useNavigate, useParams } from "react-router-dom";
import AdsList from "./AdsList";
import AdDetail from "./AdDetail";
import CreateProduct from "@/components/products/CreateProduct";
import WalletPage from "./WalletPage";
export function VendorMyAds() { return <AdsList basePath="/vendor/my-ads" />; }
export function VendorAdDetail() { const { adId } = useParams(); return <AdDetail key={adId} id={adId || ""} basePath="/vendor/my-ads" />; }
export function VendorPostAd() { const navigate = useNavigate(); return <CreateProduct mode="ad" adsBasePath="/vendor/my-ads" onCreated={() => navigate("/vendor/my-ads")} />; }
export function VendorWallet() { return <WalletPage adsHref="/vendor/my-ads" />; }
