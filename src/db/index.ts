import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

// Disable prefetch as it is not supported for Transaction pool mode
export const client = postgres(connectionString, {
  prepare: false,
  ssl: { rejectUnauthorized: false },
  max: 15,
});

export const db = drizzle(client, { schema });

export * from "./schema";
