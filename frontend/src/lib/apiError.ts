import type { AxiosError } from "axios";

export type ApiErrorBody = {
  message?: string;
  code?: string;
  details?: Record<string, string>;
  stack?: string;
};

export const isRateLimitError = (error: unknown): boolean => {
  const axiosErr = error as AxiosError<ApiErrorBody>;
  return axiosErr?.response?.status === 429;
};

export const getApiErrorMessage = (
  error: unknown,
  fallback = "Something went wrong"
): string => {
  const axiosErr = error as AxiosError<ApiErrorBody>;
  const status = axiosErr?.response?.status;

  if (status === 429) {
    return (
      axiosErr?.response?.data?.message?.trim() ||
      "Too many requests. Please wait a moment and try again."
    );
  }

  const data = axiosErr?.response?.data;
  if (data?.message && String(data.message).trim()) {
    return String(data.message);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export const getApiErrorCode = (error: unknown): string | undefined => {
  const axiosErr = error as AxiosError<ApiErrorBody>;
  return axiosErr?.response?.data?.code;
};

export const getApiErrorDetails = (
  error: unknown
): Record<string, string> | undefined => {
  const axiosErr = error as AxiosError<ApiErrorBody>;
  return axiosErr?.response?.data?.details;
};
