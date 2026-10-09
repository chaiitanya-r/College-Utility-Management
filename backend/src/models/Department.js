import mongoose from "mongoose";

const DepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

DepartmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Department = mongoose.model("Department", DepartmentSchema);
