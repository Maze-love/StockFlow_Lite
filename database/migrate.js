import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");
    await db.query(sql);
    console.log("Database migration executed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigrations();
