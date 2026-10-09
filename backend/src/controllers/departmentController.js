import {
  listDepartments as listDepartmentsService,
  createDepartment as createDepartmentService,
  deleteDepartment as deleteDepartmentService
} from "../services/departmentService.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("departmentController");

export const listDepartments = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const result = await listDepartmentsService({ orgId });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { name, code } = req.body;
    const dept = await createDepartmentService({
      orgId,
      reqUser: req.user,
      name,
      code
    });
    log.info(`Created department "${dept.name}" for org ${orgId}`);
    res.status(201).json(dept);
  } catch (err) {
    next(err);
  }
};

export const deleteDepartment = async (req, res, next) => {
  try {
    const { orgId, deptId } = req.params;
    const result = await deleteDepartmentService({ orgId, deptId });
    res.json(result);
  } catch (err) {
    next(err);
  }
};
