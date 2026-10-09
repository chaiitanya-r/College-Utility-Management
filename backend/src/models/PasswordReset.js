import mongoose from "mongoose";

const PasswordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    otpHash: { type: String, required: true }, // Hashed OTP for security (plain OTP is never stored)
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    verified: { type: Boolean, default: false },
    used: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 }, // Track verification attempts
    ipAddress: String, // Track IP for security
  },
  { timestamps: true }
);

PasswordResetSchema.index({ email: 1, organizationId: 1, verified: 1 });

export const PasswordReset = mongoose.model("PasswordReset", PasswordResetSchema);
