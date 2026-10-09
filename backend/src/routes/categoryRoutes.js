import { Router } from "express";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/categoryController.js";
import { authMiddleware, requireOrgAccess, requirePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireOrgAccess);

router.get("/", requirePermission(PERMISSIONS.UTILITY_VIEW), listCategories);
router.post("/", requirePermission(PERMISSIONS.UTILITY_MANAGE), createCategory);
router.put("/:categoryId", requirePermission(PERMISSIONS.UTILITY_MANAGE), updateCategory);
router.delete("/:categoryId", requirePermission(PERMISSIONS.UTILITY_MANAGE), deleteCategory);

export default router;


