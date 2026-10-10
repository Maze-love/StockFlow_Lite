import express from "express";
import * as orderController from "./order.controller.js";
import authenticate from "../../middleware/authenticate.js";
import requireRole from "../../middleware/requireRole.js";

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.post("/", requireRole("staff"), orderController.createOrder);
router.get("/", requireRole("viewer"), orderController.getOrders);
router.get("/:orderId", requireRole("viewer"), orderController.getOrderById);
//
router.post(
  "/:orderId/reserve",
  requireRole("staff"),
  orderController.reserveOrder
);
router.post(
  "/:orderId/confirm",
  requireRole("staff"),
  orderController.confirmOrder
);
router.post(
  "/:orderId/fulfill",
  requireRole("staff"),
  orderController.fulfillOrder
);
router.post(
  "/:orderId/cancel",
  requireRole("staff"),
  orderController.cancelOrder
);

export default router;
