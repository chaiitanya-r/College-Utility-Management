import {
  listRequisitions as listRequisitionsService,
  listDepartments as listDepartmentsService,
  getRequisition as getRequisitionService,
  createRequisition as createRequisitionService,
  updateRequisition as updateRequisitionService,
  updateRequisitionStatus as updateRequisitionStatusService,
  addComment as addCommentService,
  markPrepared as markPreparedService,
  handOver as handOverService
} from "../services/requisitionService.js";

export const listRequisitions = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { status } = req.query;
    const items = await listRequisitionsService({ orgId, status, user: req.user });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

export const listDepartments = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const departments = await listDepartmentsService({ orgId });
    res.json(departments);
  } catch (err) {
    next(err);
  }
};

export const getRequisition = async (req, res, next) => {
  try {
    const { orgId, reqId } = req.params;
    const item = await getRequisitionService({ orgId, reqId, user: req.user });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

export const createRequisition = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const requisition = await createRequisitionService({
      orgId,
      payload: req.body,
      user: req.user
    });
    res.status(201).json(requisition);
  } catch (err) {
    next(err);
  }
};

export const updateRequisition = async (req, res, next) => {
  try {
    const { orgId, reqId } = req.params;
    const requisition = await updateRequisitionService({
      orgId,
      reqId,
      payload: req.body,
      user: req.user
    });
    res.json(requisition);
  } catch (err) {
    next(err);
  }
};

export const updateRequisitionStatus = async (req, res, next) => {
  try {
    const { orgId, reqId } = req.params;
    const { action, remarks } = req.body;
    const requisition = await updateRequisitionStatusService({
      orgId,
      reqId,
      action,
      remarks,
      user: req.user
    });
    res.json(requisition);
  } catch (err) {
    next(err);
  }
};

export const addComment = async (req, res, next) => {
  try {
    const { orgId, reqId } = req.params;
    const { content } = req.body;
    const requisition = await addCommentService({
      orgId,
      reqId,
      content,
      user: req.user
    });
    res.json(requisition);
  } catch (err) {
    next(err);
  }
};

export const markPrepared = async (req, res, next) => {
  try {
    const { orgId, reqId } = req.params;
    const { billing } = req.body;
    const requisition = await markPreparedService({
      orgId,
      reqId,
      billing,
      user: req.user
    });
    res.json(requisition);
  } catch (err) {
    next(err);
  }
};

export const handOver = async (req, res, next) => {
  try {
    const { orgId, reqId } = req.params;
    const { peonName, peonPhone, billing } = req.body;
    const requisition = await handOverService({
      orgId,
      reqId,
      peonName,
      peonPhone,
      billing,
      user: req.user
    });
    res.json(requisition);
  } catch (err) {
    next(err);
  }
};
