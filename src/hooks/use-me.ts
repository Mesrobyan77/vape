"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/lib/api/client";
import type { MeResponse } from "@/lib/api/types";

export const ME_KEY = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: ({ signal }) => api<MeResponse>("/auth/me", { signal }),
    staleTime: 60_000,
  });
}

/** Refreshes everything that depends on who is signed in (user, cart, orders). */
export function useRefreshSession() {
  const client = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ME_KEY }),
      client.invalidateQueries({ queryKey: ["cart"] }),
      client.invalidateQueries({ queryKey: ["orders"] }),
      client.invalidateQueries({ queryKey: ["addresses"] }),
    ]);
  }, [client]);
}
