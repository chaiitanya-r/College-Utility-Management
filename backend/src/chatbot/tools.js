import { hasPermission, PERMISSIONS } from "../config/permissions.js";
import { validateDateOnly, validateObjectId } from "../utils/validation.js";

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export const TOOL_PERMISSIONS = {
  listUtilities: [PERMISSIONS.CHAT_USE, PERMISSIONS.UTILITY_VIEW],
  checkUtilityAvailability: [PERMISSIONS.CHAT_USE, PERMISSIONS.UTILITY_VIEW],
  lockUtilitySlot: [PERMISSIONS.CHAT_USE, PERMISSIONS.UTILITY_BOOK],
  confirmUtilityBooking: [PERMISSIONS.CHAT_USE, PERMISSIONS.UTILITY_BOOK],
  releaseLock: [PERMISSIONS.CHAT_USE, PERMISSIONS.UTILITY_BOOK],
  getUserUtilityBookings: [PERMISSIONS.CHAT_USE, PERMISSIONS.UTILITY_VIEW_OWN_BOOKINGS],
  cancelUtilityBooking: [PERMISSIONS.CHAT_USE, PERMISSIONS.UTILITY_BOOK],
  listPendingUtilityApprovals: [PERMISSIONS.CHAT_USE, PERMISSIONS.BOOKING_VIEW, PERMISSIONS.BOOKING_APPROVE],
  updateUtilityBookingStatus: [PERMISSIONS.CHAT_USE, PERMISSIONS.BOOKING_VIEW, PERMISSIONS.BOOKING_APPROVE],
  raiseMaintenanceTicket: [PERMISSIONS.CHAT_USE, PERMISSIONS.MAINTENANCE_CREATE],
  getMyMaintenanceTickets: [PERMISSIONS.CHAT_USE, PERMISSIONS.MAINTENANCE_VIEW],
  listPendingMaintenanceTickets: [PERMISSIONS.CHAT_USE, PERMISSIONS.MAINTENANCE_VIEW, PERMISSIONS.MAINTENANCE_ACT],
  actOnMaintenanceTicket: [PERMISSIONS.CHAT_USE, PERMISSIONS.MAINTENANCE_ACT],
  listMaintenanceWorkers: [PERMISSIONS.CHAT_USE, PERMISSIONS.MAINTENANCE_WORKER_MANAGE],
  getCanteenMenu: [PERMISSIONS.CHAT_USE, PERMISSIONS.CANTEEN_VIEW],
  placeCanteenOrder: [PERMISSIONS.CHAT_USE, PERMISSIONS.CANTEEN_ORDER_CREATE],
  getMyCanteenOrders: [PERMISSIONS.CHAT_USE, PERMISSIONS.CANTEEN_ORDER_VIEW_OWN],
  listPendingRequisitions: [PERMISSIONS.CHAT_USE, PERMISSIONS.REQUISITION_APPROVE],
  updateRequisitionStatus: [PERMISSIONS.CHAT_USE, PERMISSIONS.REQUISITION_APPROVE],
  listCanteenFulfillmentQueue: [PERMISSIONS.CHAT_USE, PERMISSIONS.REQUISITION_FULFILL]
};

export function canUseTool(name, userRole) {
  const perms = TOOL_PERMISSIONS[name];
  if (!perms) return false;

  const bookingTools = ["listUtilities", "checkUtilityAvailability", "lockUtilitySlot", "confirmUtilityBooking", "getUserUtilityBookings", "cancelUtilityBooking", "releaseLock"];
  const canteenTools = ["placeCanteenOrder", "getMyCanteenOrders"];
  const maintTools = ["raiseMaintenanceTicket", "getMyMaintenanceTickets"];

  const isAdmin = ["org_admin", "super_admin"].includes(userRole);

  if (bookingTools.includes(name)) {
    if (userRole !== "faculty" && !isAdmin) return false;
  }
  if (canteenTools.includes(name)) {
    if (userRole !== "assistant" && !isAdmin) return false;
  }
  if (maintTools.includes(name)) {
    if (userRole !== "faculty" && !isAdmin) return false;
  }

  return perms.every((p) => hasPermission(userRole, p));
}

export function getAllowedToolNames(userRole) {
  return Object.keys(TOOL_PERMISSIONS).filter((name) => canUseTool(name, userRole));
}

export function validateToolArgs(name, args) {
  switch (name) {
    case "cancelUtilityBooking":
      return validateObjectId(args.bookingId) ? null : "Invalid bookingId.";
    case "releaseLock":
      return validateObjectId(args.bookingId) ? null : "Invalid bookingId.";
    case "updateUtilityBookingStatus": {
      if (!validateObjectId(args.bookingId)) return "Invalid bookingId.";
      const act = normalizeText(args.action).toLowerCase();
      if (!["approve", "reject"].includes(act)) return "action must be approve or reject.";
      return null;
    }
    case "actOnMaintenanceTicket": {
      if (!validateObjectId(args.ticketId)) return "Invalid ticketId.";
      const act = normalizeText(args.action).toLowerCase();
      if (!["approve", "reject"].includes(act)) return "action must be approve or reject.";
      return null;
    }
    case "updateRequisitionStatus": {
      if (!validateObjectId(args.requisitionId)) return "Invalid requisitionId.";
      const act = normalizeText(args.action).toLowerCase();
      if (!["approve", "cancel"].includes(act)) return "action must be approve or cancel.";
      return null;
    }
    case "checkUtilityAvailability":
      return validateObjectId(args.utilityId) && validateDateOnly(args.date)
        ? null
        : "Invalid utilityId/date.";
    case "lockUtilitySlot":
      if (!validateObjectId(args.utilityId) || !validateDateOnly(args.date)) {
        return "Invalid utilityId/date.";
      }
      if (!normalizeText(args.timeSlotId)) {
        return "timeSlotId is required.";
      }
      return null;
    case "confirmUtilityBooking":
      if (!validateObjectId(args.bookingId) || normalizeText(args.purpose).length < 3) {
        return "bookingId and purpose (min 3 chars) are required.";
      }
      return null;
    case "raiseMaintenanceTicket":
      if (!normalizeText(args.title) || !normalizeText(args.description) || !normalizeText(args.location)) {
        return "title, description and location are required.";
      }
      return null;
    case "placeCanteenOrder":
      if (!Array.isArray(args.items) || args.items.length === 0) return "Order items are required.";
      for (const item of args.items) {
        if (!validateObjectId(item.menuItemId) || !Number.isFinite(item.quantity) || item.quantity <= 0) {
          return "Each order item needs valid menuItemId and quantity > 0.";
        }
      }
      return null;
    default:
      return null;
  }
}

export const TOOLS_REQUIRING_ORG = new Set([
  "listUtilities",
  "checkUtilityAvailability",
  "lockUtilitySlot",
  "confirmUtilityBooking",
  "getUserUtilityBookings",
  "cancelUtilityBooking",
  "releaseLock",
  "listPendingUtilityApprovals",
  "updateUtilityBookingStatus",
  "getCanteenMenu",
  "placeCanteenOrder",
  "getMyCanteenOrders",
  "getMyMaintenanceTickets",
  "raiseMaintenanceTicket",
  "listPendingMaintenanceTickets",
  "actOnMaintenanceTicket",
  "listMaintenanceWorkers",
  "listPendingRequisitions",
  "updateRequisitionStatus",
  "listCanteenFulfillmentQueue"
]);
