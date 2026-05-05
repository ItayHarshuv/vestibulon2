import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAccessibleUserProfile,
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "./auth.js";
import { db } from "./db/index.js";
import { programs, reps, todayReps, userProfiles } from "./db/schema.js";
import {
  assignRepToTodayRepSlot,
  ensureTodayRepsForUser,
} from "./today-reps-service.js";
import {
  createRepBodySchema,
  getRepsQuerySchema,
  getZodErrorMessage,
  updateRepBodySchema,
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
      const queryResult = getRepsQuerySchema.safeParse(req.query);
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
          id: reps.id,
          startTime: reps.startTime,
          endTime: reps.endTime,
        })
        .from(reps)
        .where(
          and(
            eq(reps.userId, targetUserId),
            inArray(reps.id, queryResult.data.ids),
          ),
        )
        .orderBy(asc(reps.startTime), asc(reps.id));

      res.status(200).json(rows);
      return;
    }

    if (req.method === "POST") {
      const bodyResult = createRepBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      const { practiceTimeKey, programId, timeZone } = bodyResult.data;
      const matchingPrograms = await db
        .select({
          id: programs.id,
          exerciseName: programs.exerciseName,
        })
        .from(programs)
        .where(
          and(
            eq(programs.id, programId),
            eq(programs.userId, authenticatedUserId),
          ),
        )
        .limit(1);

      const program = matchingPrograms[0];
      if (!program) {
        res.status(404).json({ error: "Program not found" });
        return;
      }

      const now = new Date();

      await ensureTodayRepsForUser(authenticatedUserId, timeZone);

      const inserted = await db
        .insert(reps)
        .values({
          programId: program.id,
          userId: authenticatedUserId,
          exerciseName: program.exerciseName,
          startTime: now,
        })
        .returning({
          id: reps.id,
          startTime: reps.startTime,
        });

      const createdRep = inserted[0];
      if (!createdRep) {
        res.status(500).json({ error: "Failed to create rep" });
        return;
      }

      const assigned = await assignRepToTodayRepSlot(
        authenticatedUserId,
        program.exerciseName,
        createdRep.id,
        timeZone,
        practiceTimeKey,
      );

      if (!assigned) {
        await db.delete(reps).where(eq(reps.id, createdRep.id));
        res.status(409).json({ error: "No available today rep slot for this exercise" });
        return;
      }

      res.status(201).json(createdRep);
      return;
    }

    if (req.method === "PATCH") {
      const bodyResult = updateRepBodySchema.safeParse(req.body);
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
        repId,
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
        const repRows = await db
          .select({
            startTime: reps.startTime,
            endTime: reps.endTime,
          })
          .from(reps)
          .where(and(eq(reps.id, repId), eq(reps.userId, authenticatedUserId)))
          .limit(1);

        const repRow = repRows[0];
        if (!repRow?.startTime) {
          res.status(404).json({ error: "Rep not found" });
          return;
        }

        valuesToUpdate.endTime = new Date(
          repRow.startTime.getTime() + numberOfSeconds * 1000,
        );
        shouldAwardCompletionPoints = repRow.endTime === null;
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
        .update(reps)
        .set(valuesToUpdate)
        .where(and(eq(reps.id, repId), eq(reps.userId, authenticatedUserId)))
        .returning({ id: reps.id });

      if (updated.length === 0) {
        res.status(404).json({ error: "Rep not found" });
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
          .where(and(eq(todayReps.userId, authenticatedUserId), eq(todayReps.repId, repId)))
          .limit(1);

        const currentTodayRep = currentTodayRepRows[0];
        if (currentTodayRep) {
          const sessionRows = await db
            .select({
              exerciseName: todayReps.exerciseName,
              repEndTime: reps.endTime,
            })
            .from(todayReps)
            .leftJoin(reps, eq(todayReps.repId, reps.id))
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
            currentExerciseRows.every((row) => row.repEndTime !== null);
          const didCompleteSession =
            sessionRows.length > 0 &&
            sessionRows.every((row) => row.repEndTime !== null);

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
          .update(userProfiles)
          .set({
            points: sql`${userProfiles.points} + ${pointsAwarded}`,
          })
          .where(eq(userProfiles.workosUserId, authenticatedUserId))
          .returning({
            points: userProfiles.points,
          });

        totalPoints = updatedProfile[0]?.points ?? null;
      }

      res.status(200).json({
        id: repId,
        ...valuesToUpdate,
        pointsAwarded,
        totalPoints,
      });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling reps endpoint:", error);
    res.status(500).json({ error: "Failed to handle reps endpoint" });
  }
}
