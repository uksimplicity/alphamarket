"use client";

import { useNavigate } from "react-router-dom";
import ProductStock from "@/components/products/ProductStock";

export default function VendorProductsStock() {
  const navigate = useNavigate();

  return (
    <ProductStock
      onAddStock={() => navigate("/vendor/products/stock/add")}
      onView={(id) => navigate(`/vendor/products/${id}`)}
    />
  );
}
