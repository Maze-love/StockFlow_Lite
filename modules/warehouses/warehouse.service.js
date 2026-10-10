import db from "../../config/db.js";

export async function createWarehouse(orgId, { name, location }) {
  const { rows } = await db.query(
    `INSERT INTO warehouses (organization_id, name, location) VALUES ($1, $2, $3) RETURNING *`,
    [orgId, name, location]
  );
  return rows[0];
}

export async function getWarehouses(orgId) {
  const { rows } = await db.query(
    `SELECT * FROM warehouses WHERE organization_id = $1`,
    [orgId]
  );
  return rows;
}

export async function getWarehouseById(orgId, warehouseId) {
  const { rows } = await db.query(
    `SELECT * FROM warehouses WHERE id = $1 AND organization_id = $2`,
    [warehouseId, orgId]
  );
  return rows[0];
}
