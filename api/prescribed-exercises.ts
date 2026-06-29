import { and, eq } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAccessibleUserProfile,
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "./auth.js";
import { db } from "./db/index.js";
import { prescribedExercises } from "./db/schema.js";
import {
  getZodErrorMessage,
  prescribedExercisesQuerySchema,
  updatePrescribedExerciseBodySchema,
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
      const bodyResult = updatePrescribedExerciseBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      const { prescribedExerciseId, metronomeBpmTemp } = bodyResult.data;
      const prescribedExerciseRows = await db
        .select({
          id: prescribedExercises.id,
          userId: prescribedExercises.userId,
        })
        .from(prescribedExercises)
        .where(eq(prescribedExercises.id, prescribedExerciseId))
        .limit(1);
      const prescribedExercise = prescribedExerciseRows[0];
      if (!prescribedExercise) {
        res.status(404).json({ error: "Prescribed exercise not found" });
        return;
      }

      const accessibleProfile = await getAccessibleUserProfile(
        authenticatedUser,
        prescribedExercise.userId,
      );
      if (!accessibleProfile) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const updated = await db
        .update(prescribedExercises)
        .set({ metronomeBpmTemp })
        .where(
          and(
            eq(prescribedExercises.id, prescribedExerciseId),
            eq(prescribedExercises.userId, prescribedExercise.userId),
          ),
        )
        .returning();

      const updatedRow = updated[0];
      if (!updatedRow) {
        res.status(404).json({ error: "Prescribed exercise not found" });
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

    const queryResult = prescribedExercisesQuerySchema.safeParse(req.query);
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

    const userPrescribedExercises = await db
      .select({
        id: prescribedExercises.id,
        exerciseName: prescribedExercises.exerciseName,
        numberOfSeconds: prescribedExercises.numberOfSeconds,
        numberOfRepetions: prescribedExercises.numberOfRepetions,
        metronomeBpm: prescribedExercises.metronomeBpm,
        metronomeBpmTemp: prescribedExercises.metronomeBpmTemp,
        position: prescribedExercises.position,
        background: prescribedExercises.background,
        recomendedVAS: prescribedExercises.recomendedVAS,
      })
      .from(prescribedExercises)
      .where(
        and(eq(prescribedExercises.userId, targetUserId), eq(prescribedExercises.active, true)),
      )
      .orderBy(prescribedExercises.createdAt);

    res.status(200).json(userPrescribedExercises);
  } catch (error) {
    console.error("Error fetching prescribed exercises:", error);
    res.status(500).json({ error: "Failed to fetch prescribed exercises" });
  }
}
