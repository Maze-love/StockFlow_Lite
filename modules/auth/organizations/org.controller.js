import * as orgService from "./org.service.js";

export async function createOrg(req, res, next) {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Name and slug are required.",
        },
      });
    }
    const org = await orgService.createOrganization(req.user.id, {
      name,
      slug,
    });
    res.status(201).json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
}

export async function getOrg(req, res, next) {
  try {
    const org = await orgService.getOrganizationById(req.params.organizationId);
    res.status(200).json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
}

export async function addMember(req, res, next) {
  try {
    const { email, role } = req.body;
    if (!email || !["org_admin", "staff", "viewer"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Valid email and role are required.",
        },
      });
    }
    const member = await orgService.addMember(req.params.organizationId, {
      email,
      role,
    });
    res.status(201).json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

export async function getMembers(req, res, next) {
  try {
    const members = await orgService.getMembers(req.params.organizationId);
    res.status(200).json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
}
