import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAccessibleUserProfile,
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "./auth.js";
import { db } from "./db/index.js";
import { performedReps, prescribedExercises, todayReps, users } from "./db/schema.js";
import {
  assignPerformedRepToTodayRepSlot,
  ensureTodayRepsForUser,
} from "./today-reps-service.js";
import {
  createPerformedRepBodySchema,
  getPerformedRepsQuerySchema,
  getZodErrorMessage,
  updatePerformedRepBodySchema,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,POST,PATCH,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "GET,POST,PATCH,OPTIONS");

  try {
    const authenticatedUser = await getAuthenticatedUser(req, res);
    const authenticatedUserId = authenticatedUser?.id;

    if (!authenticatedUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "GET") {
      const queryResult = getPerformedRepsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: getZodErrorMessage(queryResult.error) });
        return;
      }

      const targetUserId = queryResult.data.userId ?? authenticatedUserId;
      const accessibleProfile = await getAccessibleUserProfile(
        authenticatedUser,
        targetUserId,
      );
      if (!accessibleProfile) {
        res.status(targetUserId === authenticatedUserId ? 404 : 403).json({
          error:
            targetUserId === authenticatedUserId ? "User profile not found" : "Forbidden",
        });
        return;
      }

      const rows = await db
        .select({
          id: performedReps.id,
          startTime: performedReps.startTime,
          endTime: performedReps.endTime,
        })
        .from(performedReps)
        .where(
          and(
            eq(performedReps.userId, targetUserId),
            inArray(performedReps.id, queryResult.data.ids),
          ),
        )
        .orderBy(asc(performedReps.startTime), asc(performedReps.id));

      res.status(200).json(rows);
      return;
    }

    if (req.method === "POST") {
      const bodyResult = createPerformedRepBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      const { practiceTimeKey, prescribedExerciseId, timeZone } = bodyResult.data;
      const matchingPrescribedExercises = await db
        .select({
          id: prescribedExercises.id,
          exerciseName: prescribedExercises.exerciseName,
        })
        .from(prescribedExercises)
        .where(
          and(
            eq(prescribedExercises.id, prescribedExerciseId),
            eq(prescribedExercises.userId, authenticatedUserId),
          ),
        )
        .limit(1);

      const prescribedExercise = matchingPrescribedExercises[0];
      if (!prescribedExercise) {
        res.status(404).json({ error: "Prescribed exercise not found" });
        return;
      }

      const now = new Date();

      await ensureTodayRepsForUser(authenticatedUserId, timeZone);

      const inserted = await db
        .insert(performedReps)
        .values({
          prescribedExerciseId: prescribedExercise.id,
          userId: authenticatedUserId,
          exerciseName: prescribedExercise.exerciseName,
          startTime: now,
        })
        .returning();

      const createdPerformedRep = inserted[0];
      if (!createdPerformedRep) {
        res.status(500).json({ error: "Failed to create performed rep" });
        return;
      }

      const assigned = await assignPerformedRepToTodayRepSlot(
        authenticatedUserId,
        prescribedExercise.exerciseName,
        createdPerformedRep.id,
        timeZone,
        practiceTimeKey,
      );

      if (!assigned) {
        await db
          .delete(performedReps)
          .where(eq(performedReps.id, createdPerformedRep.id));
        res
          .status(409)
          .json({ error: "No available today rep slot for this exercise" });
        return;
      }

      res.status(201).json(createdPerformedRep);
      return;
    }

    if (req.method === "PATCH") {
      const bodyResult = updatePerformedRepBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      const {
        bpmEndOfRep,
        dizziness,
        flagPaused,
        generalDifficulty,
        nausea,
        numberOfSeconds,
        performedRepId,
      } = bodyResult.data;

      const valuesToUpdate: {
        endTime?: Date;
        bpmEndOfRep?: number;
        flagPaused?: boolean;
        dizziness?: number;
        nausea?: number;
        generalDifficulty?: number;
      } = {};
      let shouldAwardCompletionPoints = false;

      if (numberOfSeconds !== undefined) {
        const performedRepRows = await db
          .select({
            startTime: performedReps.startTime,
            endTime: performedReps.endTime,
          })
          .from(performedReps)
          .where(
            and(
              eq(performedReps.id, performedRepId),
              eq(performedReps.userId, authenticatedUserId),
            ),
          )
          .limit(1);

        const performedRepRow = performedRepRows[0];
        if (!performedRepRow?.startTime) {
          res.status(404).json({ error: "Performed rep not found" });
          return;
        }

        valuesToUpdate.endTime = new Date(
          performedRepRow.startTime.getTime() + numberOfSeconds * 1000,
        );
        shouldAwardCompletionPoints = performedRepRow.endTime === null;
      }

      if (bpmEndOfRep !== undefined) {
        valuesToUpdate.bpmEndOfRep = bpmEndOfRep;
      }

      if (flagPaused !== undefined) {
        valuesToUpdate.flagPaused = flagPaused;
      }

      if (dizziness !== undefined) {
        valuesToUpdate.dizziness = dizziness;
      }

      if (nausea !== undefined) {
        valuesToUpdate.nausea = nausea;
      }

      if (generalDifficulty !== undefined) {
        valuesToUpdate.generalDifficulty = generalDifficulty;
      }

      const updated = await db
        .update(performedReps)
        .set(valuesToUpdate)
        .where(
          and(
            eq(performedReps.id, performedRepId),
            eq(performedReps.userId, authenticatedUserId),
          ),
        )
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ error: "Performed rep not found" });
        return;
      }

      let pointsAwarded = 0;
      let totalPoints: number | null = null;

      if (shouldAwardCompletionPoints) {
        const currentTodayRepRows = await db
          .select({
            practiceTime: todayReps.practiceTime,
            exerciseName: todayReps.exerciseName,
          })
          .from(todayReps)
          .where(
            and(
              eq(todayReps.userId, authenticatedUserId),
              eq(todayReps.performedRepId, performedRepId),
            ),
          )
          .limit(1);

        const currentTodayRep = currentTodayRepRows[0];
        if (currentTodayRep) {
          const sessionRows = await db
            .select({
              exerciseName: todayReps.exerciseName,
              performedRepEndTime: performedReps.endTime,
            })
            .from(todayReps)
            .leftJoin(performedReps, eq(todayReps.performedRepId, performedReps.id))
            .where(
              and(
                eq(todayReps.userId, authenticatedUserId),
                eq(todayReps.practiceTime, currentTodayRep.practiceTime),
              ),
            );

          const currentExerciseRows = sessionRows.filter(
            (row) => row.exerciseName === currentTodayRep.exerciseName,
          );
          const didCompleteExercise =
            currentExerciseRows.length > 0 &&
            currentExerciseRows.every((row) => row.performedRepEndTime !== null);
          const didCompleteSession =
            sessionRows.length > 0 &&
            sessionRows.every((row) => row.performedRepEndTime !== null);

          pointsAwarded = 10;
          if (didCompleteExercise) {
            pointsAwarded += 100;
          }
          if (didCompleteSession) {
            pointsAwarded += 1000;
          }
        } else {
          pointsAwarded = 10;
        }

        const updatedProfile = await db
          .update(users)
          .set({
            points: sql`${users.points} + ${pointsAwarded}`,
          })
          .where(eq(users.workosUserId, authenticatedUserId))
          .returning();

        totalPoints = updatedProfile[0]?.points ?? null;
      }

      res.status(200).json({
        id: performedRepId,
        ...valuesToUpdate,
        pointsAwarded,
        totalPoints,
      });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling performed reps endpoint:", error);
    res.status(500).json({ error: "Failed to handle performed reps endpoint" });
  }
}
