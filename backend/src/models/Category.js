import mongoose from "mongoose";

const CustomFieldSchema = new mongoose.Schema(
  {
    id: { type: String },
    name: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ["text", "number", "boolean", "select", "multiselect", "textarea"],
      required: true
    },
    required: { type: Boolean, default: false },
    options: [String],
    defaultValue: mongoose.Schema.Types.Mixed,
    placeholder: String,
    showInCard: { type: Boolean, default: false },
    showInBooking: { type: Boolean, default: false }
  },
  { _id: false }
);

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

const ApprovalStepConfigSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    order: { type: Number, required: true },
    role: { type: String, required: true },
    label: { type: String, required: true },
    isRequired: { type: Boolean, default: true },
    canEdit: { type: Boolean, default: false },
    approverId: { type: String },
    approverName: { type: String }
  },
  { _id: false }
);

const CategorySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: String,
    icon: String,
    customFields: [CustomFieldSchema],
    defaultTimeSlots: [TimeSlotSchema],
    approvalFlow: {
      steps: [ApprovalStepConfigSchema],
      allowSkipOnAdminApproval: { type: Boolean, default: true },
      autoConfirmAfterLastStep: { type: Boolean, default: false }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Category = mongoose.model("Category", CategorySchema);

