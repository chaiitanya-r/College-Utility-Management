import { Router } from "express";
import {
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} from "../controllers/canteenMenuController.js";
import { authMiddleware, requirePermission, requireOrgAccess } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireOrgAccess);

router.get("/", requirePermission(PERMISSIONS.CANTEEN_VIEW), listMenuItems);
router.post(
  "/",
  requirePermission(PERMISSIONS.CANTEEN_MENU_MANAGE),
  createMenuItem
);
router.put(
  "/:itemId",
  requirePermission(PERMISSIONS.CANTEEN_MENU_MANAGE),
  updateMenuItem
);
router.delete(
  "/:itemId",
  requirePermission(PERMISSIONS.CANTEEN_MENU_MANAGE),
  deleteMenuItem
);

export default router;
