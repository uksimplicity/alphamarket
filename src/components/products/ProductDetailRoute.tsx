"use client";
import { useParams } from "react-router-dom";
import BuyerProductPage from "./BuyerProductPage";
export default function ProductDetailRoute() {
  const { productId } = useParams<{ productId: string }>();
  return <BuyerProductPage id={productId || ""} />;
}
