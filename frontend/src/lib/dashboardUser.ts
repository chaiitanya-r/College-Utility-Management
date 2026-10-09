import { getAuthUser } from "./auth";

export interface DashboardUser {
  id?: string;
  email: string;
  role: string;
  organization?: string;
  orgName?: string;
  department?: string;
}

export function buildDashboardUser(orgIdParam?: string): DashboardUser | null {
  const auth = getAuthUser();
  if (!auth.email) return null;

  const userId = auth.id || (auth as any)._id || (auth as any).sub;

  if (auth.role === "super_admin") {
    return {
      id: userId,
      email: auth.email,
      role: "super_admin",
      organization: orgIdParam || "platform",
      orgName: "Platform Admin",
    };
  }

  const organization = auth.organizationId
    ? String(auth.organizationId)
    : orgIdParam;

  return {
    id: userId,
    email: auth.email,
    role: auth.role || "faculty",
    organization,
    orgName: auth.orgName || "Organization",
    department: (auth as { department?: string }).department,
  };
}
