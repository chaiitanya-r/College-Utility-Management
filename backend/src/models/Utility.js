import mongoose from "mongoose";

const TimeSlotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    label: { type: String, required: true },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

const ApprovalStepSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    order: { type: Number, required: true },
    role: { type: String, required: true },
    label: { type: String, required: true },
    isRequired: { type: Boolean, default: true },
    approverId: { type: String }
  },
  { _id: false }
);

const DisabledDateRangeSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String }
  },
  { _id: false }
);

const UtilitySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    categoryName: { type: String, required: true },
    name: { type: String, required: true },
    linkedHallId: { type: mongoose.Schema.Types.ObjectId, ref: "Hall", default: null },
    description: String,
    customFieldValues: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    images: [String],
    isActive: { type: Boolean, default: true },
    coordinatorIds: [String],
    timeSlots: [TimeSlotSchema],
    approvalFlow: [ApprovalStepSchema],
    disabledDateRanges: [DisabledDateRangeSchema],
    disabledDaysOfWeek: [Number],
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

UtilitySchema.index({ organizationId: 1 });
UtilitySchema.index({ categoryId: 1 });

export const Utility = mongoose.model("Utility", UtilitySchema);

