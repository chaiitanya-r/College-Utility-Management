import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { getAuthToken, getAuthUser } from "@/lib/auth";
import { hasPermission, type Permission } from "@/rbac/permissions";

interface RequireAuthProps {
  children: React.ReactNode;
  roles?: string[];
  permissions?: Permission[];
  permissionsMode?: "all" | "any";
}

const RequireAuth = ({
  children,
  roles,
  permissions,
  permissionsMode = "all",
}: RequireAuthProps) => {
  const location = useLocation();
  const { orgId } = useParams<{ orgId?: string }>();
  const token = getAuthToken();
  const authUser = getAuthUser();

  if (!token) {
    const loginPath = orgId ? `/org/${orgId}/login` : "/";
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${loginPath}?redirect=${redirect}`} replace />;
  }

  const forbiddenPath = orgId ? `/org/${orgId}/forbidden` : "/forbidden";

  if (
    roles?.length &&
    authUser.role &&
    authUser.role !== "super_admin" &&
    !roles.includes(authUser.role)
  ) {
    return <Navigate to={forbiddenPath} replace state={{ from: location.pathname }} />;
  }

  if (permissions?.length && authUser.role !== "super_admin") {
    const ok =
      permissionsMode === "any"
        ? permissions.some((p) => hasPermission(authUser.role, p))
        : permissions.every((p) => hasPermission(authUser.role, p));
    if (!ok) {
      return <Navigate to={forbiddenPath} replace state={{ from: location.pathname }} />;
    }
  }

  if (
    orgId &&
    authUser.organizationId &&
    authUser.role !== "super_admin" &&
    String(authUser.organizationId) !== String(orgId)
  ) {
    return (
      <Navigate
        to={`/org/${authUser.organizationId}/forbidden`}
        replace
        state={{ wrongOrg: true }}
      />
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
