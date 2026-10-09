import {
  listOrganizations as listOrganizationsService,
  getOrganizationById as getOrganizationByIdService,
  getPlatformStats as getPlatformStatsService,
  createOrganization as createOrganizationService,
  deleteOrganization as deleteOrganizationService,
  reactivateOrganization as reactivateOrganizationService,
  purgeOrganization as purgeOrganizationService
} from "../services/organizationService.js";
import { getChatbotUsageStats as getChatbotUsageStatsService } from "../services/chatbotUsageService.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("organizationController");

export const listOrganizations = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const orgs = await listOrganizationsService(includeInactive);
    log.debug(`Listed ${orgs.length} organizations`);
    res.json(orgs);
  } catch (err) {
    next(err);
  }
};

export const getOrganization = async (req, res, next) => {
  try {
    const org = await getOrganizationByIdService(req.params.orgId);
    res.json(org);
  } catch (err) {
    next(err);
  }
};

export const getPlatformStats = async (req, res, next) => {
  try {
    const stats = await getPlatformStatsService();
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

export const getChatbotUsageStats = async (req, res, next) => {
  try {
    const stats = await getChatbotUsageStatsService();
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

export const createOrganization = async (req, res, next) => {
  try {
    const { name } = req.body;

    const org = await createOrganizationService({ name });
    res.status(201).json(org);
  } catch (err) {
    next(err);
  }
};

export const deleteOrganization = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    await deleteOrganizationService({ orgId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const reactivateOrganization = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    const org = await reactivateOrganizationService({ orgId });
    res.json(org);
  } catch (err) {
    next(err);
  }
};

export const purgeOrganization = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    const result = await purgeOrganizationService({ orgId });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

import { exportOrganizationHistory as exportOrganizationHistoryService } from "../services/organizationService.js";

export const exportOrganizationHistory = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const format = (req.query.format || "csv").toLowerCase();

    const { filename, contentType, buffer } = await exportOrganizationHistoryService({ orgId, format });

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};
