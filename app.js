import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import authRoutes from "./modules/auth/auth.routes.js";
import orgRoutes from "./modules/organizations/org.route.js";
import errorHandler from "./middleware/errorHandler.js";
import productRoutes from "./modules/products/product.routes.js";
import warehouseRoutes from "./modules/warehouses/warehouse.routes.js";
import customerRoutes from "./modules/customers/customer.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";

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

// Mount Organization Nested Sub-Routes
app.use("/api/v1/organizations/:organizationId/products", productRoutes);
app.use("/api/v1/organizations/:organizationId/warehouses", warehouseRoutes);
app.use("/api/v1/organizations/:organizationId/customers", customerRoutes);
app.use("/api/v1/organizations/:organizationId/inventory", inventoryRoutes);
app.use("/api/v1/organizations/:organizationId/orders", orderRoutes);

// Central Error Handling
app.use(errorHandler);

export default app;
