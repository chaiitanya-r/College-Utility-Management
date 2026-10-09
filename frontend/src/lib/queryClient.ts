import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        if (status === 429) return failureCount < 1;
        return failureCount < 2;
      },
      retryDelay: (attempt, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 429) {
          const retryAfter = (error as { response?: { headers?: { "retry-after"?: string } } })
            ?.response?.headers?.["retry-after"];
          const seconds = retryAfter ? parseInt(retryAfter, 10) : NaN;
          if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
          return Math.min(2000 * 2 ** attempt, 8000);
        }
        return Math.min(1000 * 2 ** attempt, 5000);
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
