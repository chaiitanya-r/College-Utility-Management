import { Category } from "../models/Category.js";
import { Utility } from "../models/Utility.js";
import { Booking } from "../models/Booking.js";
import { pick } from "../utils/object.js";

const normalizeSlug = (slug) =>
  String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

const sanitizeCategoryPayload = (payload) => {
  const result = {};

  if (payload.customFields !== undefined) {
    result.customFields = Array.isArray(payload.customFields)
      ? payload.customFields
          .filter((f) => f && (f.label || f.name))
          .map((f, idx) => ({
            id: f.id ? String(f.id) : `cf_${idx + 1}`,
            name:
              String(f.name || f.label || "")
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/[^a-z0-9_]/g, "") || `field_${idx + 1}`,
            label: String(f.label || f.name || "").trim() || `Field ${idx + 1}`,
            type: ["text", "number", "boolean", "select", "multiselect", "textarea"].includes(f.type)
              ? f.type
              : "text",
            required: Boolean(f.required),
            options: Array.isArray(f.options) ? f.options.filter(Boolean).map(String) : [],
            defaultValue: f.defaultValue,
            placeholder: f.placeholder || "",
            showInCard: Boolean(f.showInCard),
            showInBooking: Boolean(f.showInBooking)
          }))
      : [];
  }

  if (payload.defaultTimeSlots !== undefined) {
    result.defaultTimeSlots = Array.isArray(payload.defaultTimeSlots)
      ? payload.defaultTimeSlots.map((slot, idx) => ({
          id: String(slot.id || `slot-${idx + 1}`),
          startTime: String(slot.startTime || "09:00"),
          endTime: String(slot.endTime || "10:00"),
          label: String(slot.label || `${slot.startTime || "09:00"} - ${slot.endTime || "10:00"}`),
          isActive: slot.isActive !== false
        }))
      : [];
  }

  if (payload.approvalFlow !== undefined) {
    const steps = Array.isArray(payload.approvalFlow?.steps)
      ? payload.approvalFlow.steps.map((step, idx) => ({
          id: String(step.id || `step-${idx + 1}`),
          order: Number(step.order ?? idx + 1),
          role: String(step.role || "hod"),
          label: String(step.label || String(step.role || "Approver").replace(/_/g, " ").toUpperCase()),
          isRequired: step.isRequired !== false,
          canEdit: Boolean(step.canEdit),
          approverId: step.approverId ? String(step.approverId) : undefined,
          approverName: step.approverName ? String(step.approverName) : undefined
        }))
      : [];

    result.approvalFlow = {
      steps,
      allowSkipOnAdminApproval: payload.approvalFlow?.allowSkipOnAdminApproval !== false,
      autoConfirmAfterLastStep: Boolean(payload.approvalFlow?.autoConfirmAfterLastStep)
    };
  }

  return result;
};

export const listCategories = async ({ orgId }) => {
  return Category.find({ organizationId: orgId }).lean();
};

export const createCategory = async ({ orgId, payload }) => {
  if (!payload?.name || !String(payload.name).trim()) {
    const error = new Error("name is required");
    error.status = 400;
    throw error;
  }

  const slug = normalizeSlug(payload.slug || payload.name);
  if (!slug) {
    const error = new Error("slug is required");
    error.status = 400;
    throw error;
  }

  const sanitized = sanitizeCategoryPayload(payload);

  const category = await Category.create({
    organizationId: orgId,
    ...pick(payload, ["name", "description", "icon", "isActive"]),
    ...sanitized,
    slug
  });

  return category;
};

export const updateCategory = async ({ orgId, categoryId, payload }) => {
  const existingCategory = await Category.findOne({
    _id: categoryId,
    organizationId: orgId
  }).lean();

  if (!existingCategory) {
    const error = new Error("Category not found");
    error.status = 404;
    throw error;
  }

  const sanitized = sanitizeCategoryPayload(payload);
  const update = {
    ...pick(payload, ["name", "description", "icon", "isActive"]),
    ...sanitized
  };
  if (payload.slug) {
    update.slug = normalizeSlug(payload.slug);
  }

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, organizationId: orgId },
    update,
    { new: true }
  );

  if (!category) {
    const error = new Error("Category not found");
    error.status = 404;
    throw error;
  }

  if (update.approvalFlow && Array.isArray(update.approvalFlow.steps)) {
    await Utility.updateMany(
      { categoryId: category._id, organizationId: orgId, approvalFlow: { $exists: false } },
      { $set: { approvalFlow: update.approvalFlow.steps } }
    );
  }

  if (update.defaultTimeSlots && Array.isArray(update.defaultTimeSlots)) {
    await Utility.updateMany(
      { categoryId: category._id, organizationId: orgId, timeSlots: { $exists: false } },
      { $set: { timeSlots: update.defaultTimeSlots } }
    );
  }

  if (update.name) {
    await Utility.updateMany(
      { categoryId: category._id, organizationId: orgId },
      { $set: { categoryName: update.name } }
    );
    await Booking.updateMany(
      { categoryId: category._id, organizationId: orgId },
      { $set: { categoryName: update.name } }
    );
  }

  if (update.isActive !== undefined && update.isActive === false) {
    await Utility.updateMany(
      { categoryId: category._id, organizationId: orgId },
      { $set: { isActive: false } }
    );
  }

  if (update.customFields !== undefined && Array.isArray(update.customFields)) {
    const oldFields = existingCategory.customFields || [];
    const newFields = update.customFields;

    const renameMap = {};
    const oldFieldMap = {};
    oldFields.forEach((f, idx) => {
      const key = f.id || `idx_${idx}`;
      oldFieldMap[key] = f.name;
    });

    newFields.forEach((f, idx) => {
      const key = f.id || `idx_${idx}`;
      const oldName = oldFieldMap[key];
      if (oldName && oldName !== f.name) {
        renameMap[oldName] = f.name;
      }
    });

    const newFieldNames = new Set(newFields.map((f) => f.name));
    const deletedNames = oldFields
      .map((f) => f.name)
      .filter((oldName) => !newFieldNames.has(oldName) && !renameMap[oldName]);

    const utilities = await Utility.find({
      categoryId: category._id,
      organizationId: orgId
    });

    for (const util of utilities) {
      let currentMap = {};
      if (util.customFieldValues instanceof Map) {
        currentMap = Object.fromEntries(util.customFieldValues);
      } else if (util.customFieldValues && typeof util.customFieldValues === "object") {
        currentMap = JSON.parse(JSON.stringify(util.customFieldValues));
      }

      let changed = false;

      for (const [oldKey, newKey] of Object.entries(renameMap)) {
        if (currentMap[oldKey] !== undefined) {
          if (currentMap[newKey] === undefined) {
            currentMap[newKey] = currentMap[oldKey];
          }
          delete currentMap[oldKey];
          changed = true;
        }
      }

      for (const deletedKey of deletedNames) {
        if (currentMap[deletedKey] !== undefined) {
          delete currentMap[deletedKey];
          changed = true;
        }
      }

      for (const newField of newFields) {
        if (currentMap[newField.name] === undefined) {
          const defaultVal =
            newField.defaultValue !== undefined
              ? newField.defaultValue
              : newField.type === "boolean"
              ? false
              : newField.type === "number"
              ? 0
              : "";
          currentMap[newField.name] = defaultVal;
          changed = true;
        }
      }

      if (changed) {
        util.customFieldValues = currentMap;
        await util.save();
      }
    }
  }

  return category;
};

export const deleteCategory = async ({ orgId, categoryId }) => {
  const hasUtilities = await Utility.exists({
    organizationId: orgId,
    categoryId
  });
  if (hasUtilities) {
    const error = new Error("Cannot delete category with existing utilities");
    error.status = 400;
    throw error;
  }

  const result = await Category.deleteOne({
    _id: categoryId,
    organizationId: orgId
  });
  if (!result.deletedCount) {
    const error = new Error("Category not found");
    error.status = 404;
    throw error;
  }
};

