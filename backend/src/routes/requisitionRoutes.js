import { Router } from "express";
import {
  listRequisitions,
  listDepartments,
  getRequisition,
  createRequisition,
  updateRequisition,
  updateRequisitionStatus,
  addComment,
  markPrepared,
  handOver
} from "../controllers/requisitionController.js";
import { authMiddleware, requirePermission, requireOrgAccess } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";
import { canteenOrderCreateLimiter } from "../middleware/rateLimit.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireOrgAccess);

router.get("/", requirePermission(PERMISSIONS.CANTEEN_VIEW), listRequisitions);
router.get("/departments", listDepartments);
router.get("/:reqId", requirePermission(PERMISSIONS.CANTEEN_VIEW), getRequisition);

router.post(
  "/",
  canteenOrderCreateLimiter,
  requirePermission(PERMISSIONS.CANTEEN_ORDER_CREATE),
  createRequisition
);

router.patch(
  "/:reqId",
  requirePermission(PERMISSIONS.REQUISITION_APPROVE, PERMISSIONS.CANTEEN_ORDER_CREATE),
  updateRequisition
);
router.patch(
  "/:reqId/status",
  requirePermission(PERMISSIONS.REQUISITION_APPROVE),
  updateRequisitionStatus
);
router.post(
  "/:reqId/comments",
  requirePermission(PERMISSIONS.REQUISITION_APPROVE),
  addComment
);
router.patch(
  "/:reqId/prepare",
  requirePermission(PERMISSIONS.REQUISITION_FULFILL),
  markPrepared
);
router.patch(
  "/:reqId/handover",
  requirePermission(PERMISSIONS.REQUISITION_FULFILL),
  handOver
);

export default router;
