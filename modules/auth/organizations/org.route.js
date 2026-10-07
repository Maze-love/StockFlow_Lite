import express from "express";
import * as orgController from "./org.controller.js";
import authenticate from "../../middleware/authenticate.js";
import requireRole from "../../middleware/requireRole.js";

const router = express.Router();

router.use(authenticate);

router.post("/", orgController.createOrg);
router.get("/:organizationId", requireRole("viewer"), orgController.getOrg);
router.post(
  "/:organizationId/members",
  requireRole("org_admin"),
  orgController.addMember
);
router.get(
  "/:organizationId/members",
  requireRole("viewer"),
  orgController.getMembers
);

export default router;
