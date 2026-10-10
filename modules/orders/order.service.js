import db from "../../config/db.js";

export async function createDraftOrder(
  orgId,
  userId,
  { customer_id, items, idempotency_key }
) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Check Idempotency Key
    if (idempotency_key) {
      const existingOrder = await client.query(
        `SELECT * FROM orders WHERE organization_id = $1 AND idempotency_key = $2`,
        [orgId, idempotency_key]
      );
      if (existingOrder.rows.length > 0) {
        await client.query("COMMIT");
        return existingOrder.rows[0];
      }
    }

    let calculatedTotal = 0;
    const itemsToInsert = [];

    // Calculate totals & fetch pricing
    for (const item of items) {
      const prodRes = await client.query(
        `SELECT price FROM products WHERE id = $1 AND organization_id = $2`,
        [item.product_id, orgId]
      );
      if (prodRes.rows.length === 0) {
        const err = new Error(`Product ${item.product_id} not found.`);
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      }
      const unitPrice = parseFloat(prodRes.rows[0].price);
      calculatedTotal += unitPrice * item.quantity;
      itemsToInsert.push({ ...item, unit_price: unitPrice });
    }

    // Insert Order in DRAFT state
    const orderRes = await client.query(
      `INSERT INTO orders (organization_id, customer_id, status, total, idempotency_key, created_by)
       VALUES ($1, $2, 'DRAFT', $3, $4, $5) RETURNING *`,
      [orgId, customer_id, calculatedTotal, idempotency_key, userId]
    );
    const order = orderRes.rows[0];

    // Insert Items
    for (const item of itemsToInsert) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, warehouse_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.id,
          item.product_id,
          item.warehouse_id,
          item.quantity,
          item.unit_price,
        ]
      );
    }

    await client.query("COMMIT");
    return order;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getOrders(orgId) {
  const { rows } = await db.query(
    `SELECT * FROM orders WHERE organization_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
  return rows;
}

export async function getOrderById(orgId, orderId) {
  const orderRes = await db.query(
    `SELECT * FROM orders WHERE id = $1 AND organization_id = $2`,
    [orderId, orgId]
  );
  if (orderRes.rows.length === 0) return null;

  const itemsRes = await db.query(
    `SELECT * FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  return { ...orderRes.rows[0], items: itemsRes.rows };
}

// ... (keep previous createDraftOrder, getOrders, getOrderById methods)

export async function reserveOrder(orgId, userId, orderId) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // 1. Fetch order and verify state
    const orderRes = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [orderId, orgId]
    );
    if (orderRes.rows.length === 0) {
      const err = new Error("Order not found.");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    const order = orderRes.rows[0];
    if (order.status !== "DRAFT") {
      const err = new Error(`Cannot reserve order in status: ${order.status}`);
      err.status = 400;
      err.code = "INVALID_STATE_TRANSITION";
      throw err;
    }

    // 2. Fetch order items
    const itemsRes = await client.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const items = itemsRes.rows;

    // 3. Check and lock inventory for each item
    for (const item of items) {
      const invRes = await client.query(
        `SELECT * FROM inventory WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
        [item.warehouse_id, item.product_id]
      );
      const inv = invRes.rows[0];
      const available = inv ? inv.quantity_on_hand - inv.quantity_reserved : 0;

      if (!inv || available < item.quantity) {
        const err = new Error(
          `Insufficient available stock for product ${item.product_id}`
        );
        err.status = 400;
        err.code = "INSUFFICIENT_INVENTORY";
        throw err;
      }

      // Reserve stock
      await client.query(
        `UPDATE inventory SET quantity_reserved = quantity_reserved + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [item.quantity, inv.id]
      );

      // Record movement
      await client.query(
        `INSERT INTO inventory_movements (organization_id, warehouse_id, product_id, type, quantity, reference_id)
         VALUES ($1, $2, $3, 'RESERVATION', $4, $5)`,
        [orgId, item.warehouse_id, item.product_id, item.quantity, orderId]
      );
    }

    // 4. Update order status and set expiry (e.g., 15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const updatedOrderRes = await client.query(
      `UPDATE orders SET status = 'RESERVED', reservation_expires_at = $1 WHERE id = $2 RETURNING *`,
      [expiresAt, orderId]
    );

    // 5. Write Audit Log
    await client.query(
      `INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
       VALUES ($1, $2, 'RESERVE_ORDER', 'order', $3)`,
      [orgId, userId, orderId]
    );

    await client.query("COMMIT");
    return updatedOrderRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmOrder(orgId, userId, orderId) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [orderId, orgId]
    );
    if (orderRes.rows.length === 0 || orderRes.rows[0].status !== "RESERVED") {
      const err = new Error("Order not found or not in RESERVED state.");
      err.status = 400;
      err.code = "INVALID_STATE_TRANSITION";
      throw err;
    }

    const updated = await client.query(
      `UPDATE orders SET status = 'CONFIRMED' WHERE id = $1 RETURNING *`,
      [orderId]
    );

    await client.query(
      `INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
       VALUES ($1, $2, 'CONFIRM_ORDER', 'order', $3)`,
      [orgId, userId, orderId]
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function fulfillOrder(orgId, userId, orderId) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [orderId, orgId]
    );
    if (orderRes.rows.length === 0 || orderRes.rows[0].status !== "CONFIRMED") {
      const err = new Error("Order not found or not in CONFIRMED state.");
      err.status = 400;
      err.code = "INVALID_STATE_TRANSITION";
      throw err;
    }

    const itemsRes = await client.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    for (const item of itemsRes.rows) {
      await client.query(
        `UPDATE inventory 
         SET quantity_on_hand = quantity_on_hand - $1, 
             quantity_reserved = quantity_reserved - $1, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE warehouse_id = $2 AND product_id = $3`,
        [item.quantity, item.warehouse_id, item.product_id]
      );

      await client.query(
        `INSERT INTO inventory_movements (organization_id, warehouse_id, product_id, type, quantity, reference_id)
         VALUES ($1, $2, $3, 'FULFILLMENT', $4, $5)`,
        [orgId, item.warehouse_id, item.product_id, item.quantity, orderId]
      );
    }

    const updated = await client.query(
      `UPDATE orders SET status = 'FULFILLED' WHERE id = $1 RETURNING *`,
      [orderId]
    );

    await client.query(
      `INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
       VALUES ($1, $2, 'FULFILL_ORDER', 'order', $3)`,
      [orgId, userId, orderId]
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelOrder(orgId, userId, orderId) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [orderId, orgId]
    );
    if (orderRes.rows.length === 0) {
      const err = new Error("Order not found.");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    const order = orderRes.rows[0];
    if (!["DRAFT", "RESERVED"].includes(order.status)) {
      const err = new Error(`Cannot cancel order in status: ${order.status}`);
      err.status = 400;
      err.code = "INVALID_STATE_TRANSITION";
      throw err;
    }

    if (order.status === "RESERVED") {
      const itemsRes = await client.query(
        `SELECT * FROM order_items WHERE order_id = $1`,
        [orderId]
      );
      for (const item of itemsRes.rows) {
        await client.query(
          `UPDATE inventory SET quantity_reserved = quantity_reserved - $1, updated_at = CURRENT_TIMESTAMP WHERE warehouse_id = $2 AND product_id = $3`,
          [item.quantity, item.warehouse_id, item.product_id]
        );

        await client.query(
          `INSERT INTO inventory_movements (organization_id, warehouse_id, product_id, type, quantity, reference_id)
           VALUES ($1, $2, $3, 'RESERVATION_RELEASE', $4, $5)`,
          [orgId, item.warehouse_id, item.product_id, item.quantity, orderId]
        );
      }
    }

    const updated = await client.query(
      `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
      [orderId]
    );

    await client.query(
      `INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
       VALUES ($1, $2, 'CANCEL_ORDER', 'order', $3)`,
      [orgId, userId, orderId]
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
