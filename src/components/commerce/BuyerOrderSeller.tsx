"use client";

import { useSellerName } from "@/components/dashboard/useSellerName";
import type { BuyerOrder } from "./buyerOrders";

export default function BuyerOrderSeller({ order }: { order: Pick<BuyerOrder, "sellerId" | "vendor"> }) {
  const supplied = order.vendor.trim();
  const name = useSellerName({ id: order.sellerId, name: !supplied || supplied.toLowerCase() === "seller" ? "Marketplace seller" : supplied, slug: "" });
  return <span>Seller: {name.toLowerCase() === "marketplace seller" ? "Name not reported" : name}</span>;
}
