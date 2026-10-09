import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { PasswordReset } from "../models/PasswordReset.js";
import { sendEmail } from "../utils/emailService.js";
import { passwordResetOTPTemplate } from "../utils/emailTemplates.js";
import { env } from "../config/env.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;
const OTP_LENGTH = 6;

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const hashOTP = async (otp) => {
  return await bcrypt.hash(otp, 10);
};

const verifyOTP = async (otp, otpHash) => {
  return await bcrypt.compare(otp, otpHash);
};

export const requestPasswordReset = async ({ orgId, email, ipAddress }) => {
  if (!email) {
    const error = new Error("Email is required");
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();

  const isSuperAdmin = env.SUPERADMIN_EMAIL &&
    normalizedEmail === env.SUPERADMIN_EMAIL.toLowerCase();

  let user = null;
  let organization = null;

  if (isSuperAdmin) {
    // Super admin doesn't have a user record, but we can still send OTP
    // We'll handle this case in the reset password step
  } else {
    if (!orgId) {
      const error = new Error("Organization ID is required");
      error.status = 400;
      throw error;
    }

    organization = await Organization.findById(orgId);
    if (!organization) {
      const error = new Error("Invalid organization");
      error.status = 404;
      throw error;
    }

    user = await User.findOne({
      email: normalizedEmail,
      organizationId: orgId
    });

    console.log(`[Password Reset] Looking for user: ${normalizedEmail} in org: ${orgId}`);
    console.log(`[Password Reset] User found: ${user ? 'YES' : 'NO'}`);

    if (!user) {
      console.log(`[Password Reset] User not found - creating dummy record (no email will be sent)`);

      const dummyOtp = generateOTP();
      const dummyOtpHash = await hashOTP(dummyOtp + "invalid");
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

      const dummyReset = new PasswordReset({
        email: normalizedEmail,
        organizationId: orgId,
        otpHash: dummyOtpHash,
        expiresAt: expiresAt,
        ipAddress: ipAddress
      });

      await dummyReset.save();

      const message = env.NODE_ENV === "development"
        ? "DEBUG: User not found in database. No email sent. Any OTP will fail."
        : "If the email exists, an OTP has been sent to your email address.";

      return {
        success: true,
        message: message,
        resetId: dummyReset._id.toString()
      };
    }

    if (!user.passwordHash) {
      console.log(`[Password Reset] User found but has no password set`);
      const error = new Error("Password not set. Contact administrator.");
      error.status = 400;
      throw error;
    }

    console.log(`[Password Reset] User found with password hash, proceeding to send OTP`);
  }

  const otp = generateOTP();
  const otpHash = await hashOTP(otp);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

  await PasswordReset.updateMany(
    {
      email: normalizedEmail,
      organizationId: isSuperAdmin ? null : orgId,
      verified: false,
      used: false
    },
    {
      $set: { used: true }
    }
  );

  const passwordReset = new PasswordReset({
    email: normalizedEmail,
    organizationId: isSuperAdmin ? null : orgId,
    otpHash: otpHash,
    expiresAt: expiresAt,
    ipAddress: ipAddress
  });

  await passwordReset.save();

  const emailHtml = passwordResetOTPTemplate(otp, user?.name || normalizedEmail);

  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: "Password Reset OTP - College Utility Management",
    html: emailHtml
  });

  if (!emailResult.success) {
    await PasswordReset.findByIdAndDelete(passwordReset._id);
    console.error("[Password Reset] Email sending failed:", emailResult.error);
    const error = new Error(
      env.NODE_ENV === "development"
        ? `Failed to send email: ${emailResult.error || "Unknown error"}`
        : "Failed to send email. Please try again later."
    );
    error.status = 500;
    throw error;
  }

  return {
    success: true,
    message: "If the email exists, an OTP has been sent to your email address.",
    resetId: passwordReset._id.toString()
  };
};

export const verifyOTPForReset = async ({ resetId, otp, ipAddress }) => {
  if (!resetId || !otp) {
    const error = new Error("Reset ID and OTP are required");
    error.status = 400;
    throw error;
  }

  const passwordReset = await PasswordReset.findById(resetId);

  if (!passwordReset) {
    const error = new Error("Invalid or expired reset request");
    error.status = 404;
    throw error;
  }

  if (passwordReset.used) {
    const error = new Error("This reset link has already been used");
    error.status = 400;
    throw error;
  }

  if (new Date() > passwordReset.expiresAt) {
    const error = new Error("OTP has expired. Please request a new one.");
    error.status = 400;
    throw error;
  }

  if (passwordReset.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    const error = new Error("Maximum verification attempts exceeded. Please request a new OTP.");
    error.status = 429;
    throw error;
  }

  const isValid = await verifyOTP(otp, passwordReset.otpHash);

  if (!isValid) {
    passwordReset.attempts += 1;
    await passwordReset.save();

    const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - passwordReset.attempts;
    const error = new Error(
      remainingAttempts > 0
        ? `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`
        : "Maximum verification attempts exceeded. Please request a new OTP."
    );
    error.status = 400;
    throw error;
  }

  const normalizedEmail = passwordReset.email.toLowerCase();
  const isSuperAdmin = env.SUPERADMIN_EMAIL &&
    normalizedEmail === env.SUPERADMIN_EMAIL.toLowerCase();

  if (!isSuperAdmin) {
    const user = await User.findOne({
      email: normalizedEmail,
      organizationId: passwordReset.organizationId
    });

    if (!user) {
      const error = new Error("Invalid OTP. Please request a new one.");
      error.status = 400;
      throw error;
    }
  }

  passwordReset.verified = true;
  passwordReset.attempts += 1;
  await passwordReset.save();

  return {
    success: true,
    message: "OTP verified successfully",
    resetId: passwordReset._id.toString(),
    email: passwordReset.email,
    organizationId: passwordReset.organizationId
  };
};

export const resetPassword = async ({ resetId, newPassword, confirmPassword, ipAddress }) => {
  if (!resetId || !newPassword || !confirmPassword) {
    const error = new Error("Reset ID, new password, and confirmation are required");
    error.status = 400;
    throw error;
  }

  if (newPassword !== confirmPassword) {
    const error = new Error("Passwords do not match");
    error.status = 400;
    throw error;
  }

  if (newPassword.length < 8) {
    const error = new Error("Password must be at least 8 characters long");
    error.status = 400;
    throw error;
  }

  if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
    const error = new Error("Password must contain at least one letter and one number");
    error.status = 400;
    throw error;
  }

  const passwordReset = await PasswordReset.findById(resetId);

  if (!passwordReset) {
    const error = new Error("Invalid or expired reset request");
    error.status = 404;
    throw error;
  }

  if (!passwordReset.verified) {
    const error = new Error("OTP must be verified first");
    error.status = 400;
    throw error;
  }

  if (passwordReset.used) {
    const error = new Error("This reset link has already been used");
    error.status = 400;
    throw error;
  }

  if (new Date() > passwordReset.expiresAt) {
    const error = new Error("Reset request has expired. Please request a new one.");
    error.status = 400;
    throw error;
  }

  const normalizedEmail = passwordReset.email.toLowerCase();
  const isSuperAdmin = env.SUPERADMIN_EMAIL &&
    normalizedEmail === env.SUPERADMIN_EMAIL.toLowerCase();

  const passwordHash = await bcrypt.hash(newPassword, 12);

  if (isSuperAdmin) {
    const error = new Error("Super admin password reset requires system administrator intervention. Please contact your system administrator.");
    error.status = 403;
    throw error;
  }

  const user = await User.findOne({
    email: normalizedEmail,
    organizationId: passwordReset.organizationId
  });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  user.passwordHash = passwordHash;
  await user.save();

  passwordReset.used = true;
  await passwordReset.save();

  await PasswordReset.updateMany(
    {
      email: normalizedEmail,
      organizationId: passwordReset.organizationId,
      _id: { $ne: passwordReset._id },
      used: false
    },
    {
      $set: { used: true }
    }
  );

  return {
    success: true,
    message: "Password has been reset successfully"
  };
};
