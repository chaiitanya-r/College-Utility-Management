import {
  createTicket as createTicketService,
  listTickets as listTicketsService,
  getTicket as getTicketService,
  addTicketComment as addTicketCommentService,
  actOnTicket as actOnTicketService,
  listWorkers as listWorkersService,
  createWorker as createWorkerService,
  updateWorker as updateWorkerService,
  deleteWorker as deleteWorkerService,
  updateWorkerProgress as updateWorkerProgressService
} from "../services/maintenanceService.js";

export const listTickets = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const items = await listTicketsService({ orgId, user: req.user });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

export const getTicket = async (req, res, next) => {
  try {
    const { orgId, ticketId } = req.params;
    const item = await getTicketService({ orgId, ticketId, user: req.user });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

export const createTicket = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const ticket = await createTicketService({ orgId, payload: req.body, user: req.user });
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
};

export const addComment = async (req, res, next) => {
  try {
    const { orgId, ticketId } = req.params;
    const { content, attachmentUrl, attachmentName, attachmentType } = req.body || {};
    const ticket = await addTicketCommentService({
      orgId,
      ticketId,
      content,
      attachmentUrl,
      attachmentName,
      attachmentType,
      user: req.user
    });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

export const act = async (req, res, next) => {
  try {
    const { orgId, ticketId } = req.params;
    const { action, ...payload } = req.body || {};
    const ticket = await actOnTicketService({ orgId, ticketId, action, payload, user: req.user });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

export const listWorkers = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const items = await listWorkersService({ orgId, user: req.user });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

export const createWorker = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const item = await createWorkerService({ orgId, user: req.user, payload: req.body });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
};

export const updateWorker = async (req, res, next) => {
  try {
    const { orgId, workerId } = req.params;
    const item = await updateWorkerService({ orgId, workerId, user: req.user, payload: req.body });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

export const deleteWorker = async (req, res, next) => {
  try {
    const { orgId, workerId } = req.params;
    const result = await deleteWorkerService({ orgId, workerId, user: req.user });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const updateWorkerProgress = async (req, res, next) => {
  try {
    const { orgId, ticketId } = req.params;
    const ticket = await updateWorkerProgressService({
      orgId,
      ticketId,
      payload: req.body,
      user: req.user
    });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

