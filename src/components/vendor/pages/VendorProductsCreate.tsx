"use client";

import CreateProduct from "@/components/products/CreateProduct";
import { useNavigate } from "react-router-dom";
import "@/components/products/CreateProduct.css";

export default function VendorProductsCreate() {
  const navigate = useNavigate();
  return <CreateProduct onCreated={() => navigate("/vendor/products")} />;
}
