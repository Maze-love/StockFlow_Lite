import * as orderService from "./order.service.js";

export async function createOrder(req, res, next) {
  try {
    const { customer_id, items } = req.body;
    const idempotencyKey = req.headers["idempotency-key"];

    if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Customer ID and at least one item are required.",
        },
      });
    }

    const order = await orderService.createDraftOrder(
      req.organizationId,
      req.user.id,
      {
        customer_id,
        items,
        idempotency_key: idempotencyKey,
      }
    );

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function getOrders(req, res, next) {
  try {
    const orders = await orderService.getOrders(req.organizationId);
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req, res, next) {
  try {
    const order = await orderService.getOrderById(
      req.organizationId,
      req.params.orderId
    );
    if (!order)
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Order not found." },
      });
    res.status(200).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}
