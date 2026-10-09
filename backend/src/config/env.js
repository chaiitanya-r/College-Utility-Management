import dotenv from "dotenv";

dotenv.config();

const corsOriginRaw = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "*";
const CORS_ORIGIN = corsOriginRaw.includes(",")
  ? corsOriginRaw.split(",").map((o) => o.trim())
  : corsOriginRaw;

const NODE_ENV = process.env.NODE_ENV || "development";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const CORS_CREDENTIALS = process.env.CORS_CREDENTIALS === "true";

if (NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || JWT_SECRET === "dev-secret-change-me") {
    throw new Error("JWT_SECRET must be set to a strong value in production");
  }
  if (corsOriginRaw === "*" && CORS_CREDENTIALS) {
    throw new Error("CORS_ORIGIN cannot be '*' when CORS_CREDENTIALS=true");
  }
}

export const env = {
  PORT: process.env.PORT || 4000,
  NODE_ENV,
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CORS_ORIGIN,
  CORS_CREDENTIALS,
  MONGO_URI: process.env.MONGODB_URI || process.env.MONGO_URI || "",
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL || "",
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: process.env.SMTP_PORT || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === "true" || false,
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || "",
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@collegeutility.edu",
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || "College Utility Management"
};

