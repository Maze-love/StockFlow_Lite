import db from "../../config/db.js";

export async function getInventory(orgId) {
  const { rows } = await db.query(
    `SELECT i.*, p.name as product_name, w.name as warehouse_name, (i.quantity_on_hand - i.quantity_reserved) as available
     FROM inventory i
     JOIN products p ON i.product_id = p.id
     JOIN warehouses w ON i.warehouse_id = w.id
     WHERE i.organization_id = $1`,
    [orgId]
  );
  return rows;
}

export async function stockIn(orgId, { warehouse_id, product_id, quantity }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const invRes = await client.query(
      `INSERT INTO inventory (organization_id, warehouse_id, product_id, quantity_on_hand)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (warehouse_id, product_id) 
       DO UPDATE SET quantity_on_hand = inventory.quantity_on_hand + $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [orgId, warehouse_id, product_id, quantity]
    );

    await client.query(
      `INSERT INTO inventory_movements (organization_id, warehouse_id, product_id, type, quantity)
       VALUES ($1, $2, $3, 'STOCK_IN', $4)`,
      [orgId, warehouse_id, product_id, quantity]
    );

    await client.query("COMMIT");
    return invRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function transferStock(
  orgId,
  { from_warehouse_id, to_warehouse_id, product_id, quantity }
) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // 1. Lock and check source inventory
    const sourceRes = await client.query(
      `SELECT * FROM inventory 
       WHERE warehouse_id = $1 AND product_id = $2 AND organization_id = $3 
       FOR UPDATE`,
      [from_warehouse_id, product_id, orgId]
    );

    const sourceInv = sourceRes.rows[0];
    if (
      !sourceInv ||
      sourceInv.quantity_on_hand - sourceInv.quantity_reserved < quantity
    ) {
      const err = new Error("Insufficient available stock for transfer.");
      err.status = 400;
      err.code = "INSUFFICIENT_INVENTORY";
      throw err;
    }

    // 2. Decrease source stock
    await client.query(
      `UPDATE inventory SET quantity_on_hand = quantity_on_hand - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [quantity, sourceInv.id]
    );

    // 3. Increase target stock
    await client.query(
      `INSERT INTO inventory (organization_id, warehouse_id, product_id, quantity_on_hand)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (warehouse_id, product_id)
       DO UPDATE SET quantity_on_hand = inventory.quantity_on_hand + $4, updated_at = CURRENT_TIMESTAMP`,
      [orgId, to_warehouse_id, product_id, quantity]
    );

    // 4. Log movements for both operations
    await client.query(
      `INSERT INTO inventory_movements (organization_id, warehouse_id, product_id, type, quantity)
       VALUES ($1, $2, $3, 'ADJUSTMENT', $4), ($1, $5, $3, 'ADJUSTMENT', $6)`,
      [
        orgId,
        from_warehouse_id,
        product_id,
        -quantity,
        to_warehouse_id,
        quantity,
      ]
    );

    await client.query("COMMIT");
    return { success: true, message: "Stock transferred successfully." };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
