// modules/audit/audit.routes.js
import express from "express";
import authenticate from "../../middleware/authenticate.js";
import requireRole from "../../middleware/requireRole.js";
import * as auditService from "./audit.service.js";

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.get("/", requireRole("org_admin"), async (req, res, next) => {
  try {
    const logs = await auditService.getAuditLogs(req.organizationId, req.query);
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

export default router;
