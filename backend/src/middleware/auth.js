import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { hasPermission } from "../config/permissions.js";

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const role = req.user.role;
    const allowed = permissions.some((p) => hasPermission(role, p));
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

export const requireOrgAccess = (req, res, next) => {
  const orgId = req.params.orgId;
  if (!orgId) return next();
  if (req.user.role === "super_admin") return next();
  if (req.user.organizationId && String(req.user.organizationId) === String(orgId)) return next();
  return res.status(403).json({ message: "Forbidden" });
};

