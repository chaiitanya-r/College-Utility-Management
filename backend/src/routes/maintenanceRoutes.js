import { Router } from "express";
import {
  listTickets,
  getTicket,
  createTicket,
  addComment,
  act,
  listWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  updateWorkerProgress
} from "../controllers/maintenanceController.js";
import { authMiddleware, requireOrgAccess, requirePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";
import { maintenanceCreateLimiter } from "../middleware/rateLimit.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireOrgAccess);

router.get("/", requirePermission(PERMISSIONS.MAINTENANCE_VIEW), listTickets);
router.get(
  "/workers",
  requirePermission(PERMISSIONS.MAINTENANCE_WORKER_MANAGE),
  listWorkers
);
router.post(
  "/workers",
  requirePermission(PERMISSIONS.MAINTENANCE_WORKER_MANAGE),
  createWorker
);
router.put(
  "/workers/:workerId",
  requirePermission(PERMISSIONS.MAINTENANCE_WORKER_MANAGE),
  updateWorker
);
router.delete(
  "/workers/:workerId",
  requirePermission(PERMISSIONS.MAINTENANCE_WORKER_MANAGE),
  deleteWorker
);

router.get(
  "/:ticketId",
  requirePermission(PERMISSIONS.MAINTENANCE_VIEW),
  getTicket
);

router.post(
  "/",
  maintenanceCreateLimiter,
  requirePermission(PERMISSIONS.MAINTENANCE_CREATE),
  createTicket
);

router.post(
  "/:ticketId/comments",
  requirePermission(PERMISSIONS.MAINTENANCE_VIEW),
  addComment
);

router.post(
  "/:ticketId/actions",
  requirePermission(PERMISSIONS.MAINTENANCE_ACT, PERMISSIONS.MAINTENANCE_CREATE),
  act
);

router.patch(
  "/:ticketId/worker-progress",
  requirePermission(PERMISSIONS.MAINTENANCE_VIEW),
  updateWorkerProgress
);

export default router;

