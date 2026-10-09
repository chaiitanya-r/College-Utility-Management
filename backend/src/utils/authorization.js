import { hasPermission, PERMISSIONS } from "../config/permissions.js";
import { Utility } from "../models/Utility.js";
import { User } from "../models/User.js";
import mongoose from "mongoose";
import { normalizeDepartment, resolveUserDepartment } from "./department.js";

const ADMIN_ROLES = new Set(["org_admin", "super_admin"]);

export const canViewOrgBookings = (user) =>
  ADMIN_ROLES.has(user?.role) || hasPermission(user?.role, PERMISSIONS.BOOKING_APPROVE);

export const isPlatformSuperAdmin = (reqUser) => reqUser?.role === "super_admin";

export const resolveActorUser = async (reqUser) => {
  if (!reqUser?.role) return null;

  if (isPlatformSuperAdmin(reqUser)) {
    return {
      _id: reqUser.sub,
      email: reqUser.email,
      role: "super_admin",
      organizationId: reqUser.organizationId || null,
      department: "",
      name: "Super Admin",
      isPlatformSuperAdmin: true
    };
  }

  const userId = reqUser.sub || reqUser._id;
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return null;
  }

  return User.findById(userId)
     .select("name role organizationId department email")
     .lean();
};

export const resolveActorProfile = async (user, orgId) => {
  if (!user?.role) return null;

  if (user.isPlatformSuperAdmin || user.role === "super_admin") {
    return {
      _id: user._id || user.sub,
      name: user.name || "Super Admin",
      email: user.email || "",
      role: "super_admin",
      department: user.department || "",
      organizationId: orgId || user.organizationId || null
    };
  }

  const userId = user._id || user.sub;
  if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
    const dbUser = await User.findById(userId)
      .select("name role organizationId department email")
      .lean();
    if (dbUser) return dbUser;
  }

  if (user.email && orgId) {
    const dbUser = await User.findOne({
      email: String(user.email).toLowerCase(),
      organizationId: orgId
    })
      .select("name role organizationId department email")
      .lean();
    if (dbUser) return dbUser;
  }

  return null;
};

export const buildBookingListQuery = async ({ orgId, user, utilityId, status }) => {
  const query = { organizationId: orgId };
  if (utilityId) query.utilityId = utilityId;
  if (status) query.status = status;

  if (!canViewOrgBookings(user)) {
    query.requesterId = String(user.sub);
    return query;
  }

  const userRole = user.role;
  const isHod = userRole === "hod" || userRole === "dept_hod";
  if (isHod) {
    const dept = await resolveUserDepartment(orgId, user);
    if (dept) {
      const normalized = normalizeDepartment(dept);
      const regexPattern = normalized.replace(/\s+/g, "\\s+");
      query.requesterDepartment = { $regex: new RegExp(`^${regexPattern}$`, "i") };
    } else {
      query._id = { $in: [] };
    }
  }

  if (user.role === "coordinator") {
    const utilities = await Utility.find({
      organizationId: orgId,
      coordinatorIds: String(user.sub)
    })
      .select("_id")
      .lean();
    const utilityIds = utilities.map((u) => String(u._id));
    if (utilityIds.length === 0) {
      query._id = { $in: [] };
      return query;
    }
    if (utilityId) {
      if (!utilityIds.includes(String(utilityId))) {
        query._id = { $in: [] };
      }
    } else {
      query.utilityId = { $in: utilityIds };
    }
  }

  return query;
};
