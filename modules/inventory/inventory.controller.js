import * as inventoryService from "./inventory.service.js";

export async function getInventory(req, res, next) {
  try {
    const data = await inventoryService.getInventory(req.organizationId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function stockIn(req, res, next) {
  try {
    const { warehouse_id, product_id, quantity } = req.body;
    if (!warehouse_id || !product_id || !quantity || quantity <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Valid warehouse_id, product_id, and positive quantity required.",
          },
        });
    }
    const result = await inventoryService.stockIn(req.organizationId, {
      warehouse_id,
      product_id,
      quantity,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function transferStock(req, res, next) {
  try {
    const { from_warehouse_id, to_warehouse_id, product_id, quantity } =
      req.body;
    if (
      !from_warehouse_id ||
      !to_warehouse_id ||
      !product_id ||
      !quantity ||
      quantity <= 0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "All transfer fields are required with a positive quantity.",
          },
        });
    }
    const result = await inventoryService.transferStock(req.organizationId, {
      from_warehouse_id,
      to_warehouse_id,
      product_id,
      quantity,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
