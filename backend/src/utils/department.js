import { User } from "../models/User.js";

export const normalizeDepartment = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const departmentMatches = (a, b) => {
  const x = normalizeDepartment(a);
  const y = normalizeDepartment(b);
  if (!x || !y) return false;
  if (x === y) return true;

  const aliases = [
    ["comp", "computer", "computer engineering", "cse"],
    ["entc", "etc", "electronics and telecommunication", "electronics and telecommunications", "electronics and telecommunication engineering"],
    ["mech", "mechanical", "mechanical engineering"],
    ["civil", "civil engineering"],
    ["it", "information technology"],
    ["chem", "chemical", "chemical engineering"]
  ];

  for (const group of aliases) {
    if (group.includes(x) && group.includes(y)) return true;
  }

  const stripSuffix = (s) => s.replace(/\bengineering\b/g, "").trim();
  const strippedX = stripSuffix(x);
  const strippedY = stripSuffix(y);
  if (strippedX && strippedX === strippedY) return true;

  return false;
};

export const resolveUserDepartment = async (orgId, user) => {
  if (user?.department) return user.department;
  const userId = user?.sub || user?.id;
  let dbUser = null;
  if (userId) {
    dbUser = await User.findOne({ _id: userId, organizationId: orgId }).lean();
  }
  if (!dbUser && user?.email) {
    dbUser = await User.findOne({
      email: String(user.email).toLowerCase(),
      organizationId: orgId
    }).lean();
  }
  return dbUser?.department || "";
};
