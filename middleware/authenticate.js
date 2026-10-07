import jwt from "jsonwebtoken";

export default (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token missing or invalid.",
      },
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
    });
  }
};
