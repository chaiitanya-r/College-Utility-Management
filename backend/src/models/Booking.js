import mongoose from "mongoose";

const ApprovalRecordSchema = new mongoose.Schema(
  {
    stepOrder: { type: Number, required: true },
    role: { type: String, required: true },
    label: { type: String, required: true },
    approverId: { type: String, required: true },
    approverName: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], required: true },
    action: { type: String, enum: ["approve", "reject", "confirm", "cancel"], required: false },
    fromStatus: String,
    toStatus: String,
    remarks: String,
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const FeedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const BookingSchema = new mongoose.Schema(
  {
    utilityId: { type: mongoose.Schema.Types.ObjectId, ref: "Utility", required: true },
    utilityName: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    categoryName: { type: String, required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    requesterId: { type: String, required: true },
    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true },
    requesterRole: { type: String, required: true },
    requesterDepartment: { type: String, default: "General" },
    date: { type: String, required: true }, // yyyy-MM-dd
    timeSlotId: { type: String, required: true },
    timeSlotLabel: { type: String, required: true },
    purpose: { type: String, required: true },
    attendeesCount: Number,
    status: {
      type: String,
      enum: [
        "LOCKED",
        "pending",
        "coordinator_approved",
        "hod_approved",
        "registrar_approved",
        "director_approved",
        "confirmed",
        "rejected",
        "cancelled",
        "completed"
      ],
      default: "pending"
    },
    lockedBy: String,
    lockExpiresAt: Date,
    approvals: [ApprovalRecordSchema],
    approvalFlow: [mongoose.Schema.Types.Mixed],
    customFieldValues: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    feedback: FeedbackSchema
  },
  { timestamps: true }
);

BookingSchema.index(
  { organizationId: 1, utilityId: 1, date: 1, timeSlotId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          "LOCKED",
          "pending",
          "coordinator_approved",
          "hod_approved",
          "registrar_approved",
          "director_approved",
          "confirmed",
          "completed"
        ]
      }
    }
  }
);

BookingSchema.index({ organizationId: 1, requesterId: 1 });
BookingSchema.index({ organizationId: 1, status: 1 });

export const Booking = mongoose.model("Booking", BookingSchema);

