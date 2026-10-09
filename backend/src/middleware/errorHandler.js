import { env } from "../config/env.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("errorHandler");

export const notFoundHandler = (req, res, next) => {
  res.status(404).json({ message: "Route not found" });
};

const isMongoConnectionError = (err) => {
  const name = err?.name || "";
  const msg = (err?.message || "").toLowerCase();
  return (
    name === "MongoServerSelectionError" ||
    name === "MongoNetworkError" ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("mongoserverselectionerror")
  );
};

const mapMongooseError = (err) => {
  if (err.name === "ValidationError") {
    const details = {};
    for (const [path, item] of Object.entries(err.errors || {})) {
      details[path] = item?.message || "Invalid value";
    }
    return {
      status: 400,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      details
    };
  }
  if (err.name === "CastError") {
    return {
      status: 400,
      message: `Invalid ${err.path || "value"}`,
      code: "INVALID_ID"
    };
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return {
      status: 409,
      message: `Duplicate value for ${field}`,
      code: "DUPLICATE_KEY"
    };
  }
  return null;
};

const normalizeRateLimitBody = (err) => {
  if (err.status !== 429 && err.statusCode !== 429) return null;
  const raw = err.message;
  if (typeof raw === "string" && raw.trim()) {
    return { status: 429, message: raw };
  }
  if (raw && typeof raw === "object") {
    const message =
      raw.message || raw.error || "Too many requests. Please try again later.";
    return { status: 429, message };
  }
  return { status: 429, message: "Too many requests. Please try again later." };
};

export const errorHandler = (err, req, res, next) => {
  // eslint-disable-line @typescript-eslint/no-unused-vars
  log.error(err.message || "Unhandled error", { stack: err.stack, path: req.path });

  let status = err.status || err.statusCode || 500;
  let message = err.message || "Internal server error";
  let code = err.code;
  let details = err.details;

  if (isMongoConnectionError(err)) {
    status = 503;
    message =
      "Database temporarily unavailable. Check MongoDB connection and IP whitelist in Atlas.";
    code = "DB_UNAVAILABLE";
  } else {
    const mapped = mapMongooseError(err) || normalizeRateLimitBody(err);
    if (mapped) {
      status = mapped.status;
      message = mapped.message;
      code = mapped.code ?? code;
      details = mapped.details ?? details;
    }
  }

  const payload = {
    message,
    ...(code ? { code } : {}),
    ...(details ? { details } : {})
  };

  if (env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
};
