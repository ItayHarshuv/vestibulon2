import { eq } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./db/index.js";
import { programs } from "./db/schema.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow native apps (capacitor://localhost origin) to call this API.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const userId = typeof req.query?.userId === "string" ? req.query.userId : "";
  if (!userId) {
    res.status(400).json({ error: "Missing userId query param" });
    return;
  }

  try {
    const userPrograms = await db
      .select({
        id: programs.id,
        exerciseName: programs.exerciseName,
        numberOfSeconds: programs.numberOfSeconds,
        numberOfRepetions: programs.numberOfRepetions,
        metronomeBpm: programs.metronomeBpm,
        metronomeBpmTemp: programs.metronomeBpmTemp,
        position: programs.position,
        background: programs.background,
        recomendedVAS: programs.recomendedVAS,
      })
      .from(programs)
      .where(eq(programs.userId, userId))
      .orderBy(programs.createdAt);

    res.status(200).json(userPrograms);
  } catch (error) {
    console.error("Error fetching programs:", error);
    res.status(500).json({ error: "Failed to fetch programs" });
  }
}
