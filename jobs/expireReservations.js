import db from "../config/db.js";

export function startReservationExpiryJob() {
  // Run every 60 seconds as specified in Section 12
  const INTERVAL_MS = 60 * 1000;

  setInterval(async () => {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      // 1. Find RESERVED orders where reservation_expires_at < current time
      const expiredOrdersRes = await client.query(
        `SELECT id, organization_id FROM orders 
         WHERE status = 'RESERVED' AND reservation_expires_at < CURRENT_TIMESTAMP 
         FOR UPDATE SKIP LOCKED`
      );

      const expiredOrders = expiredOrdersRes.rows;

      for (const order of expiredOrders) {
        // 2. Fetch order items for this expired order
        const itemsRes = await client.query(
          `SELECT * FROM order_items WHERE order_id = $1`,
          [order.id]
        );

        for (const item of itemsRes.rows) {
          // Release reserved inventory back
          await client.query(
            `UPDATE inventory 
             SET quantity_reserved = quantity_reserved - $1, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE warehouse_id = $2 AND product_id = $3`,
            [item.quantity, item.warehouse_id, item.product_id]
          );

          // Write an inventory movement record
          await client.query(
            `INSERT INTO inventory_movements (organization_id, warehouse_id, product_id, type, quantity, reference_id)
             VALUES ($1, $2, $3, 'RESERVATION_RELEASE', $4, $5)`,
            [
              order.organization_id,
              item.warehouse_id,
              item.product_id,
              item.quantity,
              order.id,
            ]
          );
        }

        // 3. Mark order status as RESERVATION_EXPIRED
        await client.query(
          `UPDATE orders SET status = 'RESERVATION_EXPIRED' WHERE id = $1`,
          [order.id]
        );

        // 4. Write an audit log entry
        await client.query(
          `INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
           VALUES ($1, NULL, 'RESERVATION_EXPIRED', 'order', $2)`,
          [order.organization_id, order.id]
        );

        console.log(
          `[Background Job] Order ${order.id} expired; stock reservations released.`
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(
        "[Background Job Error] Failed to process expired reservations:",
        err.message
      );
    } finally {
      client.release();
    }
  }, INTERVAL_MS);

  console.log(
    "Reservation expiry background job initialized (runs every 60 seconds)."
  );
}
