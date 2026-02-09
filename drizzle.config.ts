import { type Config } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL in environment");
}

export default {
  schema: "./api/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  tablesFilter: ["vestibulon2_*"],
} satisfies Config;
