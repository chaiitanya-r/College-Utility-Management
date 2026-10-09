import { Router } from "express";
import {
  listDepartments,
  createDepartment,
  deleteDepartment
} from "../controllers/departmentController.js";
import { authMiddleware, requireOrgAccess, requirePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireOrgAccess);

router.get("/", listDepartments);
router.post("/", requirePermission(PERMISSIONS.USERS_MANAGE), createDepartment);
router.delete("/:deptId", requirePermission(PERMISSIONS.USERS_MANAGE), deleteDepartment);

export default router;
