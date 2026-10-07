import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../../config/db.js";

export async function register({ name, email, password }) {
  const existing = await db.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (existing.rows.length > 0) {
    const error = new Error("Email already registered.");
    error.status = 409;
    error.code = "CONFLICT";
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
    [name, email, passwordHash]
  );
  return rows[0];
}

export async function login({ email, password }) {
  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    const error = new Error("Invalid credentials.");
    error.status = 401;
    error.code = "INVALID_CREDENTIALS";
    throw error;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  return { token, user: { id: user.id, name: user.name, email: user.email } };
}

export async function getUserProfile(userId) {
  const { rows } = await db.query(
    "SELECT id, name, email, created_at FROM users WHERE id = $1",
    [userId]
  );
  return rows[0];
}
