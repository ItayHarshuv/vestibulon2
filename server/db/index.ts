// Shared DB client (used by Vercel functions + local dev)

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { config } from "dotenv";
import postgres from "postgres";
import * as schema from "./schema.js";

// Local dev convenience. On Vercel, env vars are injected; `.env` usually doesn't exist.
config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

// Neon’s serverless HTTP driver talks to Neon over HTTPS (port 443) and is not
// suitable for a local Postgres container. Use it only for Neon-hosted URLs.
const useNeonHttp = databaseUrl.includes("neon.tech");

export const db = useNeonHttp
  ? drizzleNeon({ client: neon(databaseUrl), schema })
  : drizzlePg({ client: postgres(databaseUrl), schema });
export { schema };
