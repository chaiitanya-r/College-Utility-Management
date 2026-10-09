import {
  listMenuItems as listMenuItemsService,
  createMenuItem as createMenuItemService,
  updateMenuItem as updateMenuItemService,
  deleteMenuItem as deleteMenuItemService
} from "../services/canteenMenuService.js";

export const listMenuItems = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const items = await listMenuItemsService({ orgId });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

export const createMenuItem = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const item = await createMenuItemService({
      orgId,
      payload: req.body,
      user: req.user
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
};

export const updateMenuItem = async (req, res, next) => {
  try {
    const { orgId, itemId } = req.params;
    const item = await updateMenuItemService({
      orgId,
      itemId,
      payload: req.body,
      user: req.user
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

export const deleteMenuItem = async (req, res, next) => {
  try {
    const { orgId, itemId } = req.params;
    await deleteMenuItemService({ orgId, itemId, user: req.user });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
