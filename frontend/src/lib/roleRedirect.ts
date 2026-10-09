import { hasPermission, PERMISSIONS } from "@/rbac/permissions";

export function getDefaultDashboardPath(role: string, orgId: string): string {
  if (role === "super_admin") return "/super-admin/dashboard";
  if (role === "org_admin") return `/org/${orgId}/admin/dashboard`;
  if (role === "coordinator") return `/org/${orgId}/coordinator/dashboard`;
  if (role === "canteen_owner") return `/org/${orgId}/dashboard`;
  if (role === "assistant") return `/org/${orgId}/canteen`;
  if (role === "workshop_hod") return `/org/${orgId}/dashboard`;
  if (role === "worker") return `/org/${orgId}/dashboard`;

  if (role === "hod" || role === "registrar" || role === "director") {
    return `/org/${orgId}/dashboard`;
  }

  if (hasPermission(role, PERMISSIONS.UTILITY_VIEW)) {
    return `/org/${orgId}`;
  }
  if (hasPermission(role, PERMISSIONS.MAINTENANCE_VIEW)) {
    return `/org/${orgId}/maintenance`;
  }
  if (hasPermission(role, PERMISSIONS.CANTEEN_VIEW)) {
    return `/org/${orgId}/canteen`;
  }

  return `/org/${orgId}/dashboard`;
}

export function getProfileRedirectPath(role: string, orgId: string): string {
  const resolvedOrgId = orgId || 'platform';

  const dashboardRoles = ['hod', 'workshop_hod', 'registrar', 'director', 'assistant'];
  if (role === 'org_admin') {
    return `/org/${resolvedOrgId}/admin/dashboard#profile`;
  } else if (dashboardRoles.includes(role)) {
    return `/org/${resolvedOrgId}/dashboard?tab=profile`;
  }

  return `/org/${resolvedOrgId}/profile`;
}

