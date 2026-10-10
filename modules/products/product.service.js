import db from "../../config/db.js";

export async function createProduct(orgId, { sku, name, price, status }) {
  const { rows } = await db.query(
    `INSERT INTO products (organization_id, sku, name, price, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [orgId, sku, name, price, status || "ACTIVE"]
  );
  return rows[0];
}

export async function getProducts(
  orgId,
  {
    page = 1,
    limit = 10,
    search,
    status,
    sortBy = "created_at",
    order = "DESC",
  }
) {
  const offset = (page - 1) * limit;
  const params = [orgId];
  let whereClauses = ["organization_id = $1"];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`name ILIKE $${params.length}`);
  }

  if (status) {
    params.push(status);
    whereClauses.push(`status = $${params.length}`);
  }

  const validSortColumns = ["name", "price", "sku", "created_at"];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "created_at";
  const sortOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

  const whereSql = whereClauses.join(" AND ");

  const countQuery = `SELECT COUNT(*) FROM products WHERE ${whereSql}`;
  const dataQuery = `
    SELECT * FROM products 
    WHERE ${whereSql} 
    ORDER BY ${sortColumn} ${sortOrder} 
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const totalRes = await db.query(countQuery, params);
  const dataRes = await db.query(dataQuery, [...params, limit, offset]);

  return {
    items: dataRes.rows,
    pagination: {
      total: parseInt(totalRes.rows[0].count, 10),
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalRes.rows[0].count / limit),
    },
  };
}

export async function getProductById(orgId, productId) {
  const { rows } = await db.query(
    `SELECT * FROM products WHERE id = $1 AND organization_id = $2`,
    [productId, orgId]
  );
  return rows[0];
}

export async function updateProduct(orgId, productId, updates) {
  const { name, price, status } = updates;
  const { rows } = await db.query(
    `UPDATE products 
     SET name = COALESCE($1, name), 
         price = COALESCE($2, price), 
         status = COALESCE($3, status)
     WHERE id = $4 AND organization_id = $5 RETURNING *`,
    [name, price, status, productId, orgId]
  );
  return rows[0];
}

export async function deleteProduct(orgId, productId) {
  const { rows } = await db.query(
    `DELETE FROM products WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [productId, orgId]
  );
  return rows[0];
}
