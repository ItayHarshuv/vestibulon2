import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAccessibleUserProfile,
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "./auth.js";
import { db } from "./db/index.js";
import {
  performedReps,
  treatmentPlanExercises,
  treatmentPlans,
  users,
} from "./db/schema.js";
import {
  getDailyScheduleForUser,
  selectCurrentSessionIndex,
} from "./daily-schedule-service.js";
import {
  getZodErrorMessage,
  prescribedExercisesQuerySchema,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "GET,OPTIONS");

  try {
    const authenticatedUser = await getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
      res.status(401).json({ error: "Unauthorized" });
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

    const profileRows = await db
      .select({ timeZone: users.timeZone })
      .from(users)
      .where(eq(users.workosUserId, targetUserId))
      .limit(1);
    const requestedTimeZone =
      typeof req.query.timeZone === "string"
        ? req.query.timeZone
        : profileRows[0]?.timeZone ?? "UTC";
    const practiceTimeKey =
      typeof req.query.practiceTimeKey === "string"
        ? req.query.practiceTimeKey
        : undefined;
    const schedule = await getDailyScheduleForUser(
      targetUserId,
      requestedTimeZone,
    );
    const sessionIndex = selectCurrentSessionIndex(
      schedule,
      requestedTimeZone,
      practiceTimeKey,
    );
    let exerciseIds = [
      ...new Set(
        schedule
          .filter((row) => row.sessionIndex === sessionIndex)
          .map((row) => row.treatmentPlanExerciseId),
      ),
    ];
    if (exerciseIds.length === 0) {
      const latestPlans = await db
        .select({ id: treatmentPlans.id })
        .from(treatmentPlans)
        .where(eq(treatmentPlans.patientUserId, targetUserId))
        .orderBy(asc(treatmentPlans.createdAt), asc(treatmentPlans.id));
      const latestPlanId = latestPlans.at(-1)?.id;
      if (latestPlanId) {
        const rows = await db
          .select({ id: treatmentPlanExercises.id })
          .from(treatmentPlanExercises)
          .where(eq(treatmentPlanExercises.treatmentPlanId, latestPlanId));
        exerciseIds = rows.map((row) => row.id);
      }
    }
    if (exerciseIds.length === 0) {
      res.status(200).json([]);
      return;
    }

    const [exerciseRows, bpmRows] = await Promise.all([
      db
        .select()
        .from(treatmentPlanExercises)
        .where(inArray(treatmentPlanExercises.id, exerciseIds))
        .orderBy(asc(treatmentPlanExercises.id)),
      db
        .select({
          exerciseCode: treatmentPlanExercises.exerciseCode,
          bpm: performedReps.bpmEndOfRep,
          startTime: performedReps.startTime,
        })
        .from(performedReps)
        .innerJoin(
          treatmentPlanExercises,
          eq(performedReps.treatmentPlanExerciseId, treatmentPlanExercises.id),
        )
        .where(
          and(
            eq(performedReps.patientUserId, targetUserId),
            isNotNull(performedReps.bpmEndOfRep),
          ),
        )
        .orderBy(asc(performedReps.startTime), asc(performedReps.id)),
    ]);
    const latestBpmByCode = new Map<string, number>();
    for (const row of bpmRows) {
      if (row.bpm !== null) latestBpmByCode.set(row.exerciseCode, row.bpm);
    }
    res.status(200).json(
      exerciseRows.map((exercise) => ({
        id: exercise.id,
        treatmentPlanExerciseId: exercise.id,
        exerciseName: exercise.exerciseCode,
        numberOfSeconds: exercise.secondsPerRep,
        numberOfRepetions: exercise.repsPerSession,
        metronomeBpm: exercise.targetBpm,
        metronomeBpmTemp:
          latestBpmByCode.get(exercise.exerciseCode) ?? null,
        position: exercise.position,
        background: exercise.background,
        recomendedVAS: exercise.recommendedVAS,
      })),
    );
  } catch (error) {
    console.error("Error fetching prescribed exercises:", error);
    res.status(500).json({ error: "Failed to fetch prescribed exercises" });
  }
}
