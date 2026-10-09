import { Router } from "express";
import {
  listUtilities,
  getUtility,
  createUtility,
  updateUtility,
  deleteUtility
} from "../controllers/utilityController.js";
import { authMiddleware, requireOrgAccess, requirePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireOrgAccess);

router.get("/", requirePermission(PERMISSIONS.UTILITY_VIEW), listUtilities);
router.get("/:utilityId", requirePermission(PERMISSIONS.UTILITY_VIEW), getUtility);
router.post("/", requirePermission(PERMISSIONS.UTILITY_MANAGE), createUtility);
router.put("/:utilityId", requirePermission(PERMISSIONS.UTILITY_MANAGE), updateUtility);
router.delete("/:utilityId", requirePermission(PERMISSIONS.UTILITY_MANAGE), deleteUtility);

export default router;


