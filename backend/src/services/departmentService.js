import { Department } from "../models/Department.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";

export const listDepartments = async ({ orgId }) => {
  const customDepts = await Department.find({ organizationId: orgId, isActive: true })
    .sort({ name: 1 })
    .lean();

  const userDepts = await User.distinct("department", {
    organizationId: orgId,
    department: { $exists: true, $ne: null, $ne: "" }
  });

  const customNames = customDepts.map((d) => d.name);

  const allNames = Array.from(
    new Set([
      ...customNames,
      ...userDepts.filter(Boolean)
    ])
  ).sort();

  return {
    departments: allNames,
    customDepartments: customDepts
  };
};

export const createDepartment = async ({ orgId, reqUser, name, code }) => {
  if (!name || !name.trim()) {
    const error = new Error("Department name is required");
    error.status = 400;
    throw error;
  }

  const trimmedName = name.trim();

  const org = await Organization.findById(orgId);
  if (!org) {
    const error = new Error("Organization not found");
    error.status = 404;
    throw error;
  }

  const escapedName = trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const existing = await Department.findOne({
    organizationId: orgId,
    name: new RegExp(`^${escapedName}$`, "i")
  });

  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      if (code) existing.code = code.trim();
      await existing.save();
      return existing;
    }
    const error = new Error(`Department "${trimmedName}" already exists in this organization`);
    error.status = 400;
    throw error;
  }

  const dept = await Department.create({
    organizationId: orgId,
    name: trimmedName,
    code: code ? code.trim() : undefined,
    isActive: true
  });

  return dept;
};

export const deleteDepartment = async ({ orgId, deptId }) => {
  const dept = await Department.findOne({ _id: deptId, organizationId: orgId });
  if (!dept) {
    const error = new Error("Department not found");
    error.status = 404;
    throw error;
  }

  dept.isActive = false;
  await dept.save();
  return { success: true, message: `Department "${dept.name}" removed.` };
};
