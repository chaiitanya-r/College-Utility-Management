import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    address: String,
    contactEmail: String,
    contactPhone: String,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Organization = mongoose.model("Organization", OrganizationSchema);


