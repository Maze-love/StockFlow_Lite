import db from "../../config/db.js";

export async function createOrganization(userId, { name, slug }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const orgRes = await client.query(
      "INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING *",
      [name, slug]
    );
    const org = orgRes.rows[0];

    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)",
      [org.id, userId, "org_admin"]
    );

    await client.query("COMMIT");
    return org;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getOrganizationById(orgId) {
  const { rows } = await db.query("SELECT * FROM organizations WHERE id = $1", [
    orgId,
  ]);
  return rows[0];
}

export async function addMember(orgId, { email, role }) {
  const userRes = await db.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (userRes.rows.length === 0) {
    const error = new Error("User with this email does not exist.");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  const userId = userRes.rows[0].id;

  const { rows } = await db.query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [orgId, userId, role]
  );

  return rows[0];
}

export async function getMembers(orgId) {
  const { rows } = await db.query(
    `SELECT om.id, u.id as user_id, u.name, u.email, om.role, om.created_at
     FROM organization_members om
     JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1`,
    [orgId]
  );
  return rows;
}
