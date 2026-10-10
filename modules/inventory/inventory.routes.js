import express from "express";
import * as inventoryController from "./inventory.controller.js";
import authenticate from "../../middleware/authenticate.js";
import requireRole from "../../middleware/requireRole.js";

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.get("/", requireRole("viewer"), inventoryController.getInventory);
router.post("/stock-in", requireRole("staff"), inventoryController.stockIn);
router.post(
  "/transfer",
  requireRole("staff"),
  inventoryController.transferStock
);

export default router;
