import { eq } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./db/index.js";
import { programs } from "./db/schema.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow native apps (capacitor://localhost origin) to call this API.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PATCH,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === "PATCH") {
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as {
              userId?: unknown;
              programId?: unknown;
              metronomeBpmTemp?: unknown;
            })
          : {};

      const userId = typeof body.userId === "string" ? body.userId.trim() : "";
      const programId =
        typeof body.programId === "number" && Number.isInteger(body.programId)
          ? body.programId
          : null;
      const metronomeBpmTemp =
        typeof body.metronomeBpmTemp === "number" &&
        Number.isInteger(body.metronomeBpmTemp)
          ? body.metronomeBpmTemp
          : null;

      if (!userId) {
        res.status(400).json({ error: "Missing userId" });
        return;
      }

      if (programId === null) {
        res.status(400).json({ error: "programId must be an integer" });
        return;
      }

      if (metronomeBpmTemp === null) {
        res.status(400).json({ error: "metronomeBpmTemp must be an integer" });
        return;
      }

      const updated = await db
        .update(programs)
        .set({ metronomeBpmTemp })
        .where(eq(programs.id, programId))
        .returning({
          id: programs.id,
          metronomeBpmTemp: programs.metronomeBpmTemp,
          userId: programs.userId,
        });

      const updatedRow = updated[0];
      if (!updatedRow || updatedRow.userId !== userId) {
        res.status(404).json({ error: "Program not found" });
        return;
      }

      res.status(200).json({
        id: updatedRow.id,
        metronomeBpmTemp: updatedRow.metronomeBpmTemp,
      });
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
