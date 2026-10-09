import mongoose from "mongoose";

const RequisitionItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: "CanteenMenu" },
    type: { type: String, enum: ["food", "beverage"], required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true },
    reasoning: { type: String, default: "" }
  },
  { _id: false }
);

const CommentSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ApprovalRecordSchema = new mongoose.Schema(
  {
    stepOrder: { type: Number, required: true },
    role: { type: String, required: true },
    label: { type: String, required: true },
    approverId: { type: String, required: true },
    approverName: { type: String, required: true },
    status: { type: String, enum: ["approved", "rejected"], required: true },
    action: {
      type: String,
      enum: ["approve", "cancel", "prepare", "handover"],
      required: false
    },
    fromStatus: String,
    toStatus: String,
    remarks: String,
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const BillingItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true }
  },
  { _id: false }
);

const BillingSchema = new mongoose.Schema(
  {
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    items: [BillingItemSchema],
    generatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const RequisitionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },
    requesterId: { type: String, required: true },
    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true },
    requesterDepartment: String,
    department: String,
    items: {
      type: [RequisitionItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one item is required"
      }
    },
    status: {
      type: String,
      enum: [
        "PENDING_HOD",
        "APPROVED_HOD",
        "APPROVED_REGISTRAR",
        "APPROVED_DIRECTOR",
        "PREPARED",
        "HANDED_OVER",
        "CANCELLED"
      ],
      default: "PENDING_HOD"
    },
    approvals: [ApprovalRecordSchema],
    comments: { type: [CommentSchema], default: [] },
    comment: String,
    submittedAt: { type: Date, default: Date.now },
    peonName: String,
    peonPhone: String,
    handedOverAt: Date,
    billing: BillingSchema
  },
  { timestamps: true }
);

RequisitionSchema.index({ organizationId: 1 });
RequisitionSchema.index({ requesterId: 1 });

export const Requisition = mongoose.model("Requisition", RequisitionSchema);
