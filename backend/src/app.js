import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";
import chatRouter from "./routes/chat.js";
import { authMiddleware } from "./middleware/auth.js";
import healthRoutes from "./routes/healthRoutes.js";
import { nosqlSanitizer } from "./middleware/nosqlSanitizer.js";

export const createApp = () => {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: env.CORS_CREDENTIALS
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"]
        }
      }
    })
  );
  app.use((req, res, next) => {
    const isLargePayloadRoute =
      (req.originalUrl.includes("/utilities") && ["POST", "PATCH", "PUT"].includes(req.method)) ||
      (req.originalUrl.includes("/maintenance") && ["POST", "PATCH", "PUT"].includes(req.method));

    const limit = isLargePayloadRoute ? "50mb" : "1mb";
    express.json({ limit })(req, res, (err) => {
      if (err) return next(err);
      express.urlencoded({ extended: true, limit })(req, res, next);
    });
  });
  app.use(nosqlSanitizer);
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use("/api", healthRoutes);

  app.use("/api/chat", apiLimiter, authMiddleware, chatRouter);
  app.use("/api", apiLimiter, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

