import mongoose from "mongoose";
import { DATE_ONLY_REGEX } from "../booking/bookingConstants.js";

export const validateObjectId = (value) => {
  if (!value) return false;
  return mongoose.Types.ObjectId.isValid(String(value));
};

export const isDateOnlyFormat = (dateStr) =>
  DATE_ONLY_REGEX.test(String(dateStr || ""));

export const validateDateOnly = (dateStr) => {
  if (!isDateOnlyFormat(dateStr)) return false;
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime());
};
export const validateCustomFieldValues = (customFields, customFieldValues, options = {}) => {
  const values = customFieldValues || {};
  if (!customFields || !Array.isArray(customFields)) return;

  const { context } = options;
  let targetFields = customFields;

  if (context === "utility") {
    targetFields = customFields.filter((f) => !f.showInBooking);
  } else if (context === "booking") {
    targetFields = customFields.filter((f) => Boolean(f.showInBooking));
  }

  for (const field of targetFields) {
    if (!field || !field.name) continue;
    const val = values[field.name];

    if (field.required && (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0))) {
      const error = new Error(`Field '${field.label || field.name}' is required`);
      error.status = 400;
      throw error;
    }

    if (val !== undefined && val !== null && val !== "") {
      if (field.type === "number") {
        if (isNaN(Number(val))) {
          const error = new Error(`Field '${field.label || field.name}' must be a valid number`);
          error.status = 400;
          throw error;
        }
      } else if (field.type === "boolean") {
        if (typeof val !== "boolean" && val !== "true" && val !== "false" && val !== 1 && val !== 0) {
          const error = new Error(`Field '${field.label || field.name}' must be a boolean`);
          error.status = 400;
          throw error;
        }
      } else if (field.type === "select") {
        if (field.options && field.options.length > 0 && !field.options.includes(val)) {
          const error = new Error(`Field '${field.label || field.name}' must be one of: ${field.options.join(", ")}`);
          error.status = 400;
          throw error;
        }
      } else if (field.type === "multiselect") {
        if (!Array.isArray(val)) {
          const error = new Error(`Field '${field.label || field.name}' must be an array for multiselect`);
          error.status = 400;
          throw error;
        }
        if (field.options && field.options.length > 0) {
          for (const item of val) {
            if (!field.options.includes(item)) {
              const error = new Error(`Value '${item}' in '${field.label || field.name}' is not a valid option`);
              error.status = 400;
              throw error;
            }
          }
        }
      }
    }
  }
};
