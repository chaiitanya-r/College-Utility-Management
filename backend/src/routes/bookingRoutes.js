import { Router } from "express";
import {
  listBookings,
  listBookingSlotOccupancy,
  getUtilityAvailability,
  createBooking,
  updateBookingStatus,
  submitFeedback,
  completeBooking,
  getUtilityReviews,
  cancelBooking,
  modifyBooking,
  lockSlot,
  confirmBooking,
  releaseLock
} from "../controllers/bookingController.js";
import { authMiddleware, requireOrgAccess, requirePermission } from "../middleware/auth.js";
import { PERMISSIONS } from "../config/permissions.js";
import { bookingCreateLimiter } from "../middleware/rateLimit.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(requireOrgAccess);

router.get("/", requirePermission(PERMISSIONS.BOOKING_VIEW), listBookings);
router.get(
  "/occupancy",
  requirePermission(PERMISSIONS.UTILITY_VIEW),
  listBookingSlotOccupancy
);
router.get(
  "/availability",
  requirePermission(PERMISSIONS.UTILITY_VIEW),
  getUtilityAvailability
);
router.get(
  "/reviews/:utilityId",
  requirePermission(PERMISSIONS.UTILITY_VIEW),
  getUtilityReviews
);
router.post("/", bookingCreateLimiter, requirePermission(PERMISSIONS.UTILITY_BOOK), createBooking);
router.post("/lock", requirePermission(PERMISSIONS.UTILITY_BOOK), lockSlot);
router.post("/confirm", requirePermission(PERMISSIONS.UTILITY_BOOK), confirmBooking);
router.post("/:bookingId/release", requirePermission(PERMISSIONS.UTILITY_BOOK), releaseLock);
router.patch(
  "/:bookingId/status",
  requirePermission(PERMISSIONS.BOOKING_APPROVE),
  updateBookingStatus
);
router.patch(
  "/:bookingId",
  requirePermission(PERMISSIONS.BOOKING_MODIFY),
  modifyBooking
);
router.post("/:bookingId/cancel", requirePermission(PERMISSIONS.UTILITY_BOOK), cancelBooking);
router.post(
  "/:bookingId/feedback",
  requirePermission(PERMISSIONS.UTILITY_VIEW_OWN_BOOKINGS),
  submitFeedback
);
router.post(
  "/:bookingId/complete",
  requirePermission(PERMISSIONS.UTILITY_VIEW_OWN_BOOKINGS),
  completeBooking
);

export default router;



