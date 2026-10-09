import { Router } from "express";
import { login } from "../controllers/authController.js";
import {
  requestPasswordReset,
  verifyOTP,
  resetPassword
} from "../controllers/passwordResetController.js";
import { authLimiter, passwordResetLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.post("/login", authLimiter, login);

router.post("/forgot-password", passwordResetLimiter, requestPasswordReset);
router.post("/verify-otp", passwordResetLimiter, verifyOTP);
router.post("/reset-password", passwordResetLimiter, resetPassword);

export default router;

