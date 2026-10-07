import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import authRoutes from "./modules/auth/auth.routes.js";
import orgRoutes from "./modules/organizations/org.routes.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." },
  },
});
app.use(limiter);

// System Health Endpoint
app.get("/health", async (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Route Modules
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/organizations", orgRoutes);

// Central Error Handling
app.use(errorHandler);

export default app;
