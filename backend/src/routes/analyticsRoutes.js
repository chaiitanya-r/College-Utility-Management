import { Router } from "express";
import {
  bookingAnalytics,
  canteenAnalytics,
  maintenanceAnalytics,
  overviewAnalytics,
  userAnalytics,
} from "../controllers/analyticsController.js";
import { authMiddleware, requirePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get("/overview", overviewAnalytics);

router.get("/bookings", requirePermission(PERMISSIONS.BOOKING_VIEW), bookingAnalytics);
router.get("/canteen", requirePermission(PERMISSIONS.CANTEEN_VIEW), canteenAnalytics);
router.get("/maintenance", requirePermission(PERMISSIONS.MAINTENANCE_VIEW), maintenanceAnalytics);

router.get("/me", userAnalytics);

export default router;
