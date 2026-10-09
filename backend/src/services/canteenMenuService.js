import { CanteenMenu } from "../models/CanteenMenu.js";

export const listMenuItems = async ({ orgId }) => {
  return CanteenMenu.find({ organizationId: orgId, isActive: true })
    .sort({ type: 1, name: 1 })
    .lean();
};

export const createMenuItem = async ({ orgId, payload, user }) => {
  const { name, type, unit, price } = payload;
  if (!name || !type) {
    const error = new Error("name and type are required");
    error.status = 400;
    throw error;
  }
  if (!["food", "beverage"].includes(type)) {
    const error = new Error("type must be food or beverage");
    error.status = 400;
    throw error;
  }
  const menuItem = await CanteenMenu.create({
    organizationId: orgId,
    name: name.trim(),
    type,
    unit: unit || "pcs",
    price: price != null ? Number(price) : undefined,
    isActive: true
  });
  return menuItem;
};

export const updateMenuItem = async ({ orgId, itemId, payload, user }) => {
  const item = await CanteenMenu.findOne({
    _id: itemId,
    organizationId: orgId
  });
  if (!item) {
    const error = new Error("Menu item not found");
    error.status = 404;
    throw error;
  }
  const { name, type, unit, price, isActive } = payload;
  if (name !== undefined) item.name = name.trim();
  if (type !== undefined) {
    if (!["food", "beverage"].includes(type)) {
      const error = new Error("type must be food or beverage");
      error.status = 400;
      throw error;
    }
    item.type = type;
  }
  if (unit !== undefined) item.unit = unit;
  if (price !== undefined) item.price = Number(price);
  if (isActive !== undefined) item.isActive = isActive;
  await item.save();
  return item;
};

export const deleteMenuItem = async ({ orgId, itemId, user }) => {
  const result = await CanteenMenu.deleteOne({
    _id: itemId,
    organizationId: orgId
  });
  if (!result.deletedCount) {
    const error = new Error("Menu item not found");
    error.status = 404;
    throw error;
  }
};
