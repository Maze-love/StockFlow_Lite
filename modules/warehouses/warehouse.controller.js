import * as warehouseService from "./warehouse.service.js";

export async function createWarehouse(req, res, next) {
  try {
    const { name, location } = req.body;
    if (!name)
      return res
        .status(400)
        .json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Name is required." },
        });
    const warehouse = await warehouseService.createWarehouse(
      req.organizationId,
      { name, location }
    );
    res.status(201).json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
}

export async function getWarehouses(req, res, next) {
  try {
    const warehouses = await warehouseService.getWarehouses(req.organizationId);
    res.status(200).json({ success: true, data: warehouses });
  } catch (err) {
    next(err);
  }
}

export async function getWarehouseById(req, res, next) {
  try {
    const warehouse = await warehouseService.getWarehouseById(
      req.organizationId,
      req.params.warehouseId
    );
    if (!warehouse)
      return res
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Warehouse not found." },
        });
    res.status(200).json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
}
