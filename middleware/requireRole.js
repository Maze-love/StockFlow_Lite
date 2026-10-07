import db from "../config/db.js";

const ROLE_HIERARCHY = {
  viewer: 1,
  staff: 2,
  org_admin: 3,
};

export default (requiredRole) => {
  return async (req, res, next) => {
    const organizationId =
      req.params.organizationId ||
      req.body.organization_id ||
      req.headers["x-organization-id"];

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Organization Context Required.",
        },
      });
    }

    try {
      const { rows } = await db.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, req.user.id]
      );

      // Return 404 instead of 403 to prevent organization existence leaks
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Resource not found." },
        });
      }

      const userRole = rows[0].role;
      if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[requiredRole]) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "Insufficient permissions." },
        });
      }

      req.orgRole = userRole;
      req.organizationId = organizationId;
      next();
    } catch (err) {
      next(err);
    }
  };
};
