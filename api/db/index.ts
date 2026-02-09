// Shared DB client (used by Vercel functions + local dev)

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import * as schema from "./schema.js";

// Local dev convenience. On Vercel, env vars are injected; `.env` usually doesn't exist.
config({ path: ".env" });

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql, schema });
export { schema };
