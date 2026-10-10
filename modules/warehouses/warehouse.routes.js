import express from "express";
import * as warehouseController from "./warehouse.controller.js";
import authenticate from "../../middleware/authenticate.js";
import requireRole from "../../middleware/requireRole.js";

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.post("/", requireRole("org_admin"), warehouseController.createWarehouse);
router.get("/", requireRole("viewer"), warehouseController.getWarehouses);
router.get(
  "/:warehouseId",
  requireRole("viewer"),
  warehouseController.getWarehouseById
);

export default router;
