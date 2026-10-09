import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['super_admin', 'org_admin', 'coordinator', 'hod', 'workshop_hod', 'registrar', 'director', 'faculty', 'assistant', 'worker', 'canteen_owner', 'budget_hod']
    },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    department: String,
    phone: String,
    passwordHash: String
  },
  { timestamps: true }
);

UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export const User = mongoose.model("User", UserSchema);

