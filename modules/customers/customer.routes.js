import express from "express";
import * as customerController from "./customer.controller.js";
import authenticate from "../../middleware/authenticate.js";
import requireRole from "../../middleware/requireRole.js";

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.post("/", requireRole("staff"), customerController.createCustomer);
router.get("/", requireRole("viewer"), customerController.getCustomers);
router.get(
  "/:customerId",
  requireRole("viewer"),
  customerController.getCustomerById
);

export default router;
