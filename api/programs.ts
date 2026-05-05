import { and, eq } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAccessibleUserProfile,
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "./auth.js";
import { db } from "./db/index.js";
import { programs } from "./db/schema.js";
import {
  getZodErrorMessage,
  programsQuerySchema,
  updateProgramBodySchema,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,PATCH,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "GET,PATCH,OPTIONS");

  try {
    const authenticatedUser = await getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "PATCH") {
      const bodyResult = updateProgramBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      const { programId, metronomeBpmTemp } = bodyResult.data;
      const programRows = await db
        .select({
          id: programs.id,
          userId: programs.userId,
        })
        .from(programs)
        .where(eq(programs.id, programId))
        .limit(1);
      const program = programRows[0];
      if (!program) {
        res.status(404).json({ error: "Program not found" });
        return;
      }

      const accessibleProfile = await getAccessibleUserProfile(
        authenticatedUser,
        program.userId,
      );
      if (!accessibleProfile) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const updated = await db
        .update(programs)
        .set({ metronomeBpmTemp })
        .where(
          and(
            eq(programs.id, programId),
            eq(programs.userId, program.userId),
          ),
        )
        .returning({
          id: programs.id,
          metronomeBpmTemp: programs.metronomeBpmTemp,
        });

      const updatedRow = updated[0];
      if (!updatedRow) {
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

    const targetUserId = queryResult.data.userId ?? authenticatedUser.id;
    const accessibleProfile = await getAccessibleUserProfile(
      authenticatedUser,
      targetUserId,
    );
    if (!accessibleProfile) {
      res.status(targetUserId === authenticatedUser.id ? 404 : 403).json({
        error:
          targetUserId === authenticatedUser.id ? "User profile not found" : "Forbidden",
      });
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
      .where(
        and(eq(programs.userId, targetUserId), eq(programs.active, true)),
      )
      .orderBy(programs.createdAt);

    res.status(200).json(userPrograms);
  } catch (error) {
    console.error("Error fetching programs:", error);
    res.status(500).json({ error: "Failed to fetch programs" });
  }
}
