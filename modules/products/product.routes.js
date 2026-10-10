import express from "express";
import * as productController from "./product.controller.js";
import authenticate from "../../middleware/authenticate.js";
import requireRole from "../../middleware/requireRole.js";

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.post("/", requireRole("staff"), productController.createProduct);
router.get("/", requireRole("viewer"), productController.getProducts);
router.get(
  "/:productId",
  requireRole("viewer"),
  productController.getProductById
);
router.patch(
  "/:productId",
  requireRole("staff"),
  productController.updateProduct
);
router.delete(
  "/:productId",
  requireRole("org_admin"),
  productController.deleteProduct
);

export default router;
