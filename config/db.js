import { Pool } from "pg";
import dotnet from "dotenv";
dotnet.config();

const db = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  max: 10,
});

db.on("connect", () => {
  console.log("db connected");
});

db.on("error", () => {
  console.log("db connection error");
});

export default {
  query: (text, params) => db.query(text, params),
};
