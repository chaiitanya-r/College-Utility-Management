import { Router } from "express";
import {
  listOrganizations,
  getOrganization,
  getPlatformStats,
  getChatbotUsageStats,
  createOrganization,
  deleteOrganization,
  reactivateOrganization,
  purgeOrganization,
  exportOrganizationHistory
} from "../controllers/organizationController.js";
import { authMiddleware, requirePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router();

router.get("/", listOrganizations);

router.get(
  "/stats/platform",
  authMiddleware,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  getPlatformStats
);

router.get(
  "/stats/chatbot-usage",
  authMiddleware,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  getChatbotUsageStats
);

router.get("/:orgId/public", getOrganization);

router.get(
  "/:orgId/export-history",
  authMiddleware,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  exportOrganizationHistory
);

router.post("/", authMiddleware, requirePermission(PERMISSIONS.ORG_MANAGE), createOrganization);
router.patch("/:orgId/reactivate", authMiddleware, requirePermission(PERMISSIONS.ORG_MANAGE), reactivateOrganization);
router.delete("/:orgId/purge", authMiddleware, requirePermission(PERMISSIONS.ORG_MANAGE), purgeOrganization);
router.delete("/:orgId", authMiddleware, requirePermission(PERMISSIONS.ORG_MANAGE), deleteOrganization);

export default router;


