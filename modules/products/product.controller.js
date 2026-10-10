import * as productService from "./product.service.js";

export async function createProduct(req, res, next) {
  try {
    const { sku, name, price, status } = req.body;
    if (!sku || !name || price == null) {
      return res
        .status(400)
        .json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "SKU, name, and price are required.",
          },
        });
    }
    const product = await productService.createProduct(req.organizationId, {
      sku,
      name,
      price,
      status,
    });
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function getProducts(req, res, next) {
  try {
    const result = await productService.getProducts(
      req.organizationId,
      req.query
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req, res, next) {
  try {
    const product = await productService.getProductById(
      req.organizationId,
      req.params.productId
    );
    if (!product)
      return res
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Product not found." },
        });
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await productService.updateProduct(
      req.organizationId,
      req.params.productId,
      req.body
    );
    if (!product)
      return res
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Product not found." },
        });
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await productService.deleteProduct(
      req.organizationId,
      req.params.productId
    );
    if (!product)
      return res
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Product not found." },
        });
    res
      .status(200)
      .json({
        success: true,
        data: { message: "Product deleted successfully." },
      });
  } catch (err) {
    next(err);
  }
}
