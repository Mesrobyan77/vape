"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState, type ReactNode } from "react";
import { isApiError } from "@/lib/api/client";
import { ToastProvider } from "./Toaster";
import { UiStateProvider } from "./UiState";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Retry transient failures once; never retry client errors (4xx).
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return failureCount < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      {/* Motion follows the OS "reduce motion" setting for every animation. */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <UiStateProvider>{children}</UiStateProvider>
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
