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
