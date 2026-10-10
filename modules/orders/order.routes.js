import express from "express";
import * as orderController from "./order.controller.js";
import authenticate from "../../middleware/authenticate.js";
import requireRole from "../../middleware/requireRole.js";

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.post("/", requireRole("staff"), orderController.createOrder);
router.get("/", requireRole("viewer"), orderController.getOrders);
router.get("/:orderId", requireRole("viewer"), orderController.getOrderById);

export default router;
