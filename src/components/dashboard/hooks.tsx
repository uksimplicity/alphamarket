"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "./api";

export function useApi<T>(path: string) {
  return useQuery({
    queryKey: ["api", path],
    queryFn: () => fetcher<T>(path),
  });
}
