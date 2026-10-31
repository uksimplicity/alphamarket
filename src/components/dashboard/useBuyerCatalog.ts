"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { buyerCatalogPage } from "./buyerCatalog";

export function useBuyerCatalog(search: string) {
  const query = useInfiniteQuery({
    queryKey: ["public-catalog", search.trim()],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "24", offset: String(pageParam) });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/products/public?${params}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("We couldn't load the latest listings. Please try again.");
      return buyerCatalogPage(await response.json(), 24, pageParam);
    },
    getNextPageParam: page => page.hasMore ? page.nextOffset : undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const products = [...new Map(query.data?.pages.flatMap(page => page.products).map(product => [product.id, product])).values()];
  return { ...query, products };
}
