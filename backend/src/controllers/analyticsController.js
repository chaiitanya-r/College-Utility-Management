import {
  getBookingAnalytics,
  getCanteenAnalytics,
  getMaintenanceAnalytics,
  getOverviewAnalytics,
  getPlatformAnalytics,
  getUserAnalytics,
} from "../services/analyticsService.js";
import { resolveActorProfile } from "../utils/authorization.js";

const extractFilters = (query) => ({
  startDate: query.startDate || null,
  endDate: query.endDate || null,
  department: query.department || null,
  facilityId: query.facilityId || null,
  status: query.status || null,
});

export const bookingAnalytics = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const actor = await resolveActorProfile(req.user, orgId);
    if (!actor) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const filters = extractFilters(req.query);

    if (actor.role === "coordinator") {
      filters.coordinatorId = actor._id ? String(actor._id) : req.user.sub || req.user.id;
    } else if (["hod", "assistant"].includes(actor.role)) {
      filters.department = actor.department;
    } else if (actor.role !== "org_admin" && actor.role !== "super_admin" && actor.role !== "workshop_hod") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const data = await getBookingAnalytics(orgId, filters);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const canteenAnalytics = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const actor = await resolveActorProfile(req.user, orgId);
    if (!actor) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const filters = extractFilters(req.query);

    if (["hod", "assistant"].includes(actor.role)) {
      filters.department = actor.department;
    } else if (actor.role !== "org_admin" && actor.role !== "super_admin" && actor.role !== "canteen_owner") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const data = await getCanteenAnalytics(orgId, filters);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const maintenanceAnalytics = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const actor = await resolveActorProfile(req.user, orgId);
    if (!actor) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const filters = extractFilters(req.query);

    if (actor.role === "hod") {
      filters.department = actor.department;
    } else if (actor.role !== "org_admin" && actor.role !== "super_admin" && actor.role !== "workshop_hod") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const data = await getMaintenanceAnalytics(orgId, filters);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const overviewAnalytics = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const actor = await resolveActorProfile(req.user, orgId);
    if (!actor) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const filters = extractFilters(req.query);

    if (["hod", "assistant"].includes(actor.role)) {
      filters.department = actor.department;
    } else if (actor.role !== "org_admin" && actor.role !== "super_admin" && actor.role !== "workshop_hod") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const data = await getOverviewAnalytics(orgId, filters);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const platformAnalytics = async (req, res, next) => {
  try {
    const filters = extractFilters(req.query);
    const data = await getPlatformAnalytics(filters);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const userAnalytics = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const userId = req.user?.sub;
    const role = req.user?.role;
    const filters = extractFilters(req.query);
    const data = await getUserAnalytics(orgId, userId, role, filters);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
