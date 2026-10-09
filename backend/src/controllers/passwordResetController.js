import {
  requestPasswordReset as requestPasswordResetService,
  verifyOTPForReset as verifyOTPForResetService,
  resetPassword as resetPasswordService
} from "../services/passwordResetService.js";

export const requestPasswordReset = async (req, res, next) => {
  try {
    const { orgId, email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await requestPasswordResetService({
      orgId,
      email,
      ipAddress
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
};

export const verifyOTP = async (req, res, next) => {
  try {
    const { resetId, otp } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await verifyOTPForResetService({
      resetId,
      otp,
      ipAddress
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { resetId, newPassword, confirmPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await resetPasswordService({
      resetId,
      newPassword,
      confirmPassword,
      ipAddress
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
};
