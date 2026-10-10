import * as customerService from "./customer.service.js";

export async function createCustomer(req, res, next) {
  try {
    const { name, email } = req.body;
    if (!name || !email)
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Name and email are required.",
        },
      });
    const customer = await customerService.createCustomer(req.organizationId, {
      name,
      email,
    });
    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

export async function getCustomers(req, res, next) {
  try {
    const customers = await customerService.getCustomers(req.organizationId);
    res.status(200).json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerById(req, res, next) {
  try {
    const customer = await customerService.getCustomerById(
      req.organizationId,
      req.params.customerId
    );
    if (!customer)
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Customer not found." },
      });
    res.status(200).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}
