import mongoose from "mongoose";

const CanteenMenuSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },
    name: { type: String, required: true },
    type: { type: String, enum: ["food", "beverage"], required: true },
    unit: { type: String, required: true, default: "pcs" },
    price: { type: Number, required: false, min: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

CanteenMenuSchema.index({ organizationId: 1 });

export const CanteenMenu = mongoose.model("CanteenMenu", CanteenMenuSchema);
