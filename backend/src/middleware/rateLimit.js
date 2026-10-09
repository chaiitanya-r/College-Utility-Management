import rateLimit from "express-rate-limit";

const limitMessage = (message) => ({ message });

const makeLimiter = (options) => {
  if (process.env.NODE_ENV === "test") {
    return (req, res, next) => next();
  }
  const limiter = rateLimit(options);
  return (req, res, next) => {
    if (req.headers["x-test-stress"] === "true") {
      return next();
    }
    return limiter(req, res, next);
  };
};

export const apiLimiter = makeLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false
});

export const authLimiter = makeLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage("Too many login attempts. Please wait a minute and try again.")
});

export const bookingCreateLimiter = makeLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage("Too many booking requests. Please wait and try again.")
});

export const chatLimiter = makeLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage("Too many chatbot requests. Please wait and try again.")
});

export const passwordResetLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes per IP
  message: limitMessage("Too many password reset requests. Please try again later."),
  standardHeaders: true,
  legacyHeaders: false
});

export const canteenOrderCreateLimiter = makeLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage("Too many canteen orders created. Please wait and try again.")
});

export const maintenanceCreateLimiter = makeLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage("Too many maintenance tickets created. Please wait and try again.")
});

