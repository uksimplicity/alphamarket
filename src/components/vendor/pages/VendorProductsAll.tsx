"use client";

import { useNavigate } from "react-router-dom";
import ProductList from "@/components/products/ProductList";
import "@/components/products/ProductList.css";

export default function VendorProductsAll() {
  const navigate = useNavigate();

  return (
    <ProductList
      onView={(id) => navigate(`/vendor/products/${id}`)}
      onEdit={(id) => navigate(`/vendor/products/${id}/edit`)}
      onCreate={() => navigate(`/vendor/products/create`)}
    />
  );
}
