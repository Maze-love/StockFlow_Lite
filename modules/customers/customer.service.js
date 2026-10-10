import db from "../../config/db.js";

export async function createCustomer(orgId, { name, email }) {
  const { rows } = await db.query(
    `INSERT INTO customers (organization_id, name, email) VALUES ($1, $2, $3) RETURNING *`,
    [orgId, name, email]
  );
  return rows[0];
}

export async function getCustomers(orgId) {
  const { rows } = await db.query(
    `SELECT * FROM customers WHERE organization_id = $1`,
    [orgId]
  );
  return rows;
}

export async function getCustomerById(orgId, customerId) {
  const { rows } = await db.query(
    `SELECT * FROM customers WHERE id = $1 AND organization_id = $2`,
    [customerId, orgId]
  );
  return rows[0];
}
