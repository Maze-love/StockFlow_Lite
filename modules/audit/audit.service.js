// modules/audit/audit.service.js
import db from "../../config/db.js";

export async function getAuditLogs(
  orgId,
  { actor_id, action, resource_type, startDate, endDate }
) {
  let query = `SELECT * FROM audit_logs WHERE organization_id = $1`;
  const params = [orgId];

  if (actor_id) {
    params.push(actor_id);
    query += ` AND actor_id = $${params.length}`;
  }
  if (action) {
    params.push(action);
    query += ` AND action = $${params.length}`;
  }
  if (resource_type) {
    params.push(resource_type);
    query += ` AND resource_type = $${params.length}`;
  }
  if (startDate) {
    params.push(startDate);
    query += ` AND created_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    query += ` AND created_at <= $${params.length}`;
  }

  query += ` ORDER BY created_at DESC`;
  const { rows } = await db.query(query, params);
  return rows;
}
