import { eq } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./db/index.js";
import { programs } from "./db/schema.js";
import {
  getZodErrorMessage,
  programsQuerySchema,
  updateProgramBodySchema,
} from "../src/lib/validation.js";

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
      const bodyResult = updateProgramBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      const { userId, programId, metronomeBpmTemp } = bodyResult.data;

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
      if (updatedRow?.userId !== userId) {
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

    const queryResult = programsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: getZodErrorMessage(queryResult.error) });
      return;
    }

    const { userId } = queryResult.data;

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
