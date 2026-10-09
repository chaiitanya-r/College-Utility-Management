export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
}

export function getAuthUser(): {
  id?: string;
  _id?: string;
  sub?: string;
  email?: string;
  role?: string;
  organizationId?: string;
  orgName?: string;
  name?: string;
  department?: string;
  phone?: string;
} {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("auth_user") || sessionStorage.getItem("auth_user");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function setAuth(token: string, user: any): void {
  if (typeof window === "undefined") return;
  const userStr = typeof user === "string" ? user : JSON.stringify(user);
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", userStr);
  sessionStorage.setItem("auth_token", token);
  sessionStorage.setItem("auth_user", userStr);
  window.dispatchEvent(new Event("auth-changed"));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem("auth_user");
  window.dispatchEvent(new Event("auth-changed"));
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
