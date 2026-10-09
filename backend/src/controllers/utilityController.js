import {
  listUtilities as listUtilitiesService,
  getUtilityById as getUtilityByIdService,
  createUtility as createUtilityService,
  updateUtility as updateUtilityService,
  deleteUtility as deleteUtilityService
} from "../services/utilityService.js";

export const listUtilities = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { categoryId } = req.query;

    const items = await listUtilitiesService({ orgId, categoryId });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

export const getUtility = async (req, res, next) => {
  try {
    const { orgId, utilityId } = req.params;
    const utility = await getUtilityByIdService({ orgId, utilityId });
    res.json(utility);
  } catch (err) {
    next(err);
  }
};

export const createUtility = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const utility = await createUtilityService({ orgId, payload: req.body });
    res.status(201).json(utility);
  } catch (err) {
    next(err);
  }
};

export const updateUtility = async (req, res, next) => {
  try {
    const { orgId, utilityId } = req.params;
    const utility = await updateUtilityService({
      orgId,
      utilityId,
      payload: req.body
    });
    res.json(utility);
  } catch (err) {
    next(err);
  }
};

export const deleteUtility = async (req, res, next) => {
  try {
    const { orgId, utilityId } = req.params;

    await deleteUtilityService({ orgId, utilityId });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
