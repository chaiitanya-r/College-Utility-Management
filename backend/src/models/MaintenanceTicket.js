import mongoose from "mongoose";

const TicketCommentSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    content: { type: String, default: "" },
    attachmentUrl: { type: String, default: null },
    attachmentName: { type: String, default: null },
    attachmentType: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const TicketActionLogSchema = new mongoose.Schema(
  {
    stepOrder: { type: Number, required: true },
    role: { type: String, required: true },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true }, // approve | reject | mark_purchase_required | budget_approve | assign_worker | complete | pause | reopen
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    remarks: String,
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const TicketItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const WorkerProgressSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["NOT_STARTED", "ONGOING", "ON_HOLD", "INCOMPLETE", "COMPLETED"],
      default: "NOT_STARTED",
      required: true
    },
    reason: {
      type: String,
      required: function() {
        return this.status === "ON_HOLD" || this.status === "INCOMPLETE";
      }
    },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const MaintenanceTicketSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },
    requesterId: { type: String, required: true },
    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true },
    requesterDepartment: { type: String, default: "" },

    department: { type: String, required: true },

    issueCategory: { type: String, enum: ["minor", "major"], required: true },
    problemTitle: { type: String, required: true },
    actualProblem: { type: String, required: true },
    itemsToRepair: { type: [TicketItemSchema], default: [] },

    status: {
      type: String,
      enum: [
        "PENDING_DEPT_HOD",
        "PENDING_WORKSHOP_HOD",
        "PENDING_BUDGET_DEPT_HOD",
        "PENDING_REGISTRAR",
        "PENDING_DIRECTOR",
        "BACK_TO_WORKSHOP_AFTER_APPROVALS",
        "ASSIGNED_TO_WORKER",
        "PENDING_WORKSHOP_VERIFICATION",
        "PAUSED",
        "COMPLETED",
        "REJECTED"
      ],
      default: "PENDING_WORKSHOP_HOD"
    },
    purchaseRequired: { type: Boolean, default: false },
    estimatedCost: { type: Number, default: null },

    assignedWorkerId: { type: String, default: null },
    assignedWorkerName: { type: String, default: null },

    pauseReason: { type: String, default: null },
    pausedAt: { type: Date, default: null },
    pausedById: { type: String, default: null },
    pausedByName: { type: String, default: null },

    comments: { type: [TicketCommentSchema], default: [] },
    actionLogs: { type: [TicketActionLogSchema], default: [] },
    workerProgress: {
      type: WorkerProgressSchema,
      default: () => ({ status: "NOT_STARTED", reason: "", updatedAt: new Date() })
    },

    submittedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

MaintenanceTicketSchema.index({ organizationId: 1 });
MaintenanceTicketSchema.index({ requesterId: 1 });
MaintenanceTicketSchema.index({ assignedWorkerId: 1 });

export const MaintenanceTicket = mongoose.model("MaintenanceTicket", MaintenanceTicketSchema);

