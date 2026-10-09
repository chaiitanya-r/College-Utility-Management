import mongoose from "mongoose";

export const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
};

export const toObjectIdOrNull = (value) => {
  if (!value) return null;
  const str = String(value);
  if (!mongoose.Types.ObjectId.isValid(str)) return null;
  return new mongoose.Types.ObjectId(str);
};
