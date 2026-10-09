import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { MaintenanceTicket } from "../models/MaintenanceTicket.js";

const ALLOWED_ROLES = [
  "org_admin",
  "coordinator",
  "hod",
  "workshop_hod",
  "registrar",
  "director",
  "worker",
  "faculty",
  "assistant",
  "canteen_owner"
];

const canActOnOrg = (reqUser, orgId) => {
  if (reqUser.role === "super_admin") return true;
  if (reqUser.role === "org_admin" && String(reqUser.organizationId) === String(orgId))
    return true;
  if (reqUser.role === "workshop_hod" && String(reqUser.organizationId) === String(orgId))
    return true;
  return false;
};

export const listUsers = async ({ orgId, reqUser }) => {
  if (!canActOnOrg(reqUser, orgId)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  if (reqUser.role === "workshop_hod") {
    return User.find({ organizationId: orgId, role: "worker" }).lean();
  }

  return User.find({ organizationId: orgId }).lean();
};

export const createUser = async ({ orgId, reqUser, payload }) => {
  const { name, email, password, role, department, phone } = payload;

  if (!canActOnOrg(reqUser, orgId)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  if (reqUser.role === "workshop_hod" && role !== "worker") {
    const error = new Error("Workshop HOD can only create worker accounts.");
    error.status = 403;
    throw error;
  }

  if (!name || !email || !password || !role) {
    const error = new Error("name, email, password, role are required");
    error.status = 400;
    throw error;
  }

  if (!ALLOWED_ROLES.includes(role)) {
    const error = new Error("Invalid role");
    error.status = 400;
    throw error;
  }

  const org = await Organization.findById(orgId);
  if (!org) {
    const error = new Error("Invalid organization");
    error.status = 400;
    throw error;
  }

  const existing = await User.findOne({
    organizationId: orgId,
    email: email.toLowerCase()
  });
  if (existing) {
    const error = new Error("User with this email already exists in this organization");
    error.status = 400;
    throw error;
  }

  const resolvedDept = department && String(department).trim()
    ? String(department).trim()
    : (["super_admin", "org_admin"].includes(role) ? "Administration" : (role === "worker" ? "Workshop" : ""));

  if (!resolvedDept) {
    const error = new Error("Department is required when creating a user.");
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    organizationId: orgId,
    department: resolvedDept,
    phone
  });

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId
  };
};

export const updateUser = async ({ orgId, userId, reqUser, payload }) => {
  const { name, email, password, role, department, phone } = payload;

  if (!canActOnOrg(reqUser, orgId)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const user = await User.findOne({
    _id: userId,
    organizationId: orgId
  });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (reqUser.role === "workshop_hod") {
    if (user.role !== "worker") {
      const error = new Error("Workshop HOD can only manage worker accounts.");
      error.status = 403;
      throw error;
    }
    if (role && role !== "worker") {
      const error = new Error("Workshop HOD cannot change worker to another role.");
      error.status = 403;
      throw error;
    }
  }

  if (name) user.name = name;
  if (email && email.toLowerCase() !== user.email.toLowerCase()) {
    const existing = await User.findOne({
      organizationId: orgId,
      email: email.toLowerCase(),
      _id: { $ne: userId }
    });
    if (existing) {
      const error = new Error("Email already exists in this organization");
      error.status = 400;
      throw error;
    }
    user.email = email.toLowerCase();
  }
  if (role && ALLOWED_ROLES.includes(role)) user.role = role;
  if (department !== undefined) user.department = department;
  if (phone !== undefined) user.phone = phone;
  if (password) {
    user.passwordHash = await bcrypt.hash(password, 10);
  }

  await user.save();

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    department: user.department,
    phone: user.phone
  };
};

export const deleteUser = async ({ orgId, userId, reqUser }) => {
  if (!canActOnOrg(reqUser, orgId)) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const targetUser = await User.findOne({ _id: userId, organizationId: orgId });
  if (!targetUser) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (reqUser.role === "workshop_hod" && targetUser.role !== "worker") {
    const error = new Error("Workshop HOD can only delete worker accounts.");
    error.status = 403;
    throw error;
  }

  const isWorker = targetUser.role === "worker";

  const result = await User.deleteOne({
    _id: userId,
    organizationId: orgId
  });

  if (!result.deletedCount) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (isWorker) {
    await MaintenanceTicket.updateMany(
      {
        organizationId: orgId,
        assignedWorkerId: String(userId),
        status: { $in: ["ASSIGNED_TO_WORKER", "PAUSED", "BACK_TO_WORKSHOP_AFTER_APPROVALS"] }
      },
      {
        $set: {
          status: "PENDING_WORKSHOP_HOD",
          assignedWorkerId: null,
          assignedWorkerName: null
        }
      }
    );
  }
};

export const updateSelfProfile = async ({ orgId, userId, payload }) => {
  const { name, email, phone } = payload;

  const user = await User.findOne({
    _id: userId,
    organizationId: orgId
  });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;

  if (email && email.toLowerCase() !== user.email.toLowerCase()) {
    const existing = await User.findOne({
      organizationId: orgId,
      email: email.toLowerCase(),
      _id: { $ne: userId }
    });
    if (existing) {
      const error = new Error("Email already exists in this organization");
      error.status = 400;
      throw error;
    }
    user.email = email.toLowerCase();
  }

  await user.save();

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    department: user.department,
    phone: user.phone
  };
};

