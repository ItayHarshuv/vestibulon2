import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
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
import { getDateKeyInTimeZone } from "./timezone-utils.js";
import {
  createPerformedRepBodySchema,
  getPerformedRepsQuerySchema,
  getZodErrorMessage,
  type UpdatePerformedRepBody,
  updatePerformedRepBodySchema,
} from "../src/lib/validation.js";

async function updatePerformedRepAndPoints(
  userId: string,
  body: UpdatePerformedRepBody,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const currentRows = await tx
      .select({
        startTime: performedReps.startTime,
        endTime: performedReps.endTime,
        restTime: performedReps.restTime,
        scheduledDate: performedReps.scheduledDate,
        sessionIndex: performedReps.sessionIndex,
        treatmentPlanExerciseId: performedReps.treatmentPlanExerciseId,
        treatmentPlanId: treatmentPlanExercises.treatmentPlanId,
        expectedExerciseReps: treatmentPlanExercises.repsPerSession,
      })
      .from(performedReps)
      .leftJoin(
        treatmentPlanExercises,
        eq(performedReps.treatmentPlanExerciseId, treatmentPlanExercises.id),
      )
      .where(
        and(
          eq(performedReps.id, body.performedRepId),
          eq(performedReps.patientUserId, userId),
        ),
      )
      .limit(1);
    const current = currentRows[0];
    if (!current) return null;

    const values: {
      endTime?: Date;
      bpmEndOfRep?: number;
      flagPaused?: boolean;
      restTime?: number;
      dizziness?: number;
      nausea?: number;
      generalDifficulty?: number;
    } = {};
    const newlyCompleted =
      body.numberOfSeconds !== undefined && current.endTime === null;
    if (newlyCompleted) {
      values.endTime = new Date(
        current.startTime.getTime() + body.numberOfSeconds! * 1000,
      );
    }
    if (body.bpmEndOfRep !== undefined) values.bpmEndOfRep = body.bpmEndOfRep;
    if (body.flagPaused !== undefined) values.flagPaused = body.flagPaused;
    if (
      body.finalizeRest === true &&
      current.endTime !== null &&
      current.restTime === null
    ) {
      values.restTime = Math.max(
        0,
        Math.floor((Date.now() - current.endTime.getTime()) / 1000),
      );
    }
    if (body.dizziness !== undefined) values.dizziness = body.dizziness;
    if (body.nausea !== undefined) values.nausea = body.nausea;
    if (body.generalDifficulty !== undefined) {
      values.generalDifficulty = body.generalDifficulty;
    }

    const updatedRows = await tx
      .update(performedReps)
      .set(values)
      .where(eq(performedReps.id, body.performedRepId))
      .returning();
    let pointsAwarded = 0;
    let totalPoints: number | null = null;

    if (newlyCompleted) {
      pointsAwarded = 10;
      if (
        current.scheduledDate &&
        current.sessionIndex !== null &&
        current.treatmentPlanExerciseId !== null &&
        current.treatmentPlanId !== null
      ) {
        const [exerciseCompleted, sessionCompleted, sessionExpected] =
          await Promise.all([
            tx
              .select({ count: sql<number>`count(*)` })
              .from(performedReps)
              .where(
                and(
                  eq(performedReps.patientUserId, userId),
                  eq(performedReps.scheduledDate, current.scheduledDate),
                  eq(performedReps.sessionIndex, current.sessionIndex),
                  eq(
                    performedReps.treatmentPlanExerciseId,
                    current.treatmentPlanExerciseId,
                  ),
                  isNotNull(performedReps.endTime),
                ),
              ),
            tx
              .select({ count: sql<number>`count(*)` })
              .from(performedReps)
              .where(
                and(
                  eq(performedReps.patientUserId, userId),
                  eq(performedReps.scheduledDate, current.scheduledDate),
                  eq(performedReps.sessionIndex, current.sessionIndex),
                  isNotNull(performedReps.endTime),
                ),
              ),
            tx
              .select({
                count: sql<number>`coalesce(sum(${treatmentPlanExercises.repsPerSession}), 0)`,
              })
              .from(treatmentPlanExercises)
              .where(
                eq(
                  treatmentPlanExercises.treatmentPlanId,
                  current.treatmentPlanId,
                ),
              ),
          ]);
        if (
          Number(exerciseCompleted[0]?.count ?? 0) >=
          (current.expectedExerciseReps ?? Number.POSITIVE_INFINITY)
        ) {
          pointsAwarded += 100;
        }
        if (
          Number(sessionCompleted[0]?.count ?? 0) >=
          Number(sessionExpected[0]?.count ?? Number.POSITIVE_INFINITY)
        ) {
          pointsAwarded += 1000;
        }
      }
      const updatedUsers = await tx
        .update(users)
        .set({ points: sql`${users.points} + ${pointsAwarded}` })
        .where(eq(users.workosUserId, userId))
        .returning();
      totalPoints = updatedUsers[0]?.points ?? null;
    }

    return {
      id: body.performedRepId,
      ...updatedRows[0],
      pointsAwarded,
      totalPoints,
    };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,POST,PATCH,OPTIONS")) return;
  setApiHeaders(req, res, "GET,POST,PATCH,OPTIONS");

  try {
    const authenticatedUser = await getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = authenticatedUser.id;

    if (req.method === "GET") {
      const parsed = getPerformedRepsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: getZodErrorMessage(parsed.error) });
        return;
      }
      const targetUserId = parsed.data.userId ?? userId;
      const accessible = await getAccessibleUserProfile(
        authenticatedUser,
        targetUserId,
      );
      if (!accessible) {
        res.status(targetUserId === userId ? 404 : 403).json({
          error: targetUserId === userId ? "User profile not found" : "Forbidden",
        });
        return;
      }
      const rows = await db
        .select({
          id: performedReps.id,
          startTime: performedReps.startTime,
          endTime: performedReps.endTime,
          restTime: performedReps.restTime,
        })
        .from(performedReps)
        .where(
          and(
            eq(performedReps.patientUserId, targetUserId),
            inArray(performedReps.id, parsed.data.ids),
          ),
        )
        .orderBy(asc(performedReps.startTime), asc(performedReps.id));
      res.status(200).json(rows);
      return;
    }

    if (req.method === "POST") {
      const parsed = createPerformedRepBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: getZodErrorMessage(parsed.error) });
        return;
      }
      const {
        clientRequestId,
        practiceTimeKey,
        timeZone,
        treatmentPlanExerciseId,
      } = parsed.data;
      if (clientRequestId) {
        const existing = await db
          .select()
          .from(performedReps)
          .where(
            and(
              eq(performedReps.patientUserId, userId),
              eq(performedReps.clientRequestId, clientRequestId),
            ),
          )
          .limit(1);
        if (existing[0]) {
          res.status(200).json(existing[0]);
          return;
        }
      }
      const ownedRows = await db
        .select({ id: treatmentPlanExercises.id })
        .from(treatmentPlanExercises)
        .innerJoin(
          treatmentPlans,
          eq(treatmentPlanExercises.treatmentPlanId, treatmentPlans.id),
        )
        .where(
          and(
            eq(treatmentPlanExercises.id, treatmentPlanExerciseId),
            eq(treatmentPlans.patientUserId, userId),
          ),
        )
        .limit(1);
      if (!ownedRows[0]) {
        res.status(404).json({ error: "Treatment plan exercise not found" });
        return;
      }

      const schedule = await getDailyScheduleForUser(userId, timeZone);
      const sessionIndex = selectCurrentSessionIndex(
        schedule,
        timeZone,
        practiceTimeKey,
      );
      const slot = schedule.find(
        (row) =>
          row.sessionIndex === sessionIndex &&
          row.treatmentPlanExerciseId === treatmentPlanExerciseId &&
          row.performedRepId === null,
      );
      if (!slot) {
        res
          .status(409)
          .json({ error: "No available today rep slot for this exercise" });
        return;
      }
      const inserted = await db
        .insert(performedReps)
        .values({
          treatmentPlanExerciseId,
          patientUserId: userId,
          scheduledDate: getDateKeyInTimeZone(
            new Date(slot.practiceTime),
            timeZone,
          ),
          sessionIndex: slot.sessionIndex,
          repIndex: slot.repIndex,
          scheduledAt: new Date(slot.practiceTime),
          clientRequestId: clientRequestId ?? null,
          startTime: new Date(),
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted[0]) {
        res.status(409).json({ error: "Rep slot was already claimed" });
        return;
      }

      const previousCompletedRows = await db
        .select({
          id: performedReps.id,
          endTime: performedReps.endTime,
          restTime: performedReps.restTime,
        })
        .from(performedReps)
        .where(
          and(
            eq(performedReps.patientUserId, userId),
            eq(performedReps.scheduledDate, inserted[0].scheduledDate!),
            eq(performedReps.sessionIndex, inserted[0].sessionIndex!),
            isNotNull(performedReps.endTime),
          ),
        )
        .orderBy(desc(performedReps.endTime), desc(performedReps.id))
        .limit(1);
      const previousCompleted = previousCompletedRows[0];
      if (
        previousCompleted?.endTime &&
        previousCompleted.restTime === null
      ) {
        await db
          .update(performedReps)
          .set({
            restTime: Math.max(
              0,
              Math.floor(
                (inserted[0].startTime.getTime() -
                  previousCompleted.endTime.getTime()) /
                  1000,
              ),
            ),
          })
          .where(eq(performedReps.id, previousCompleted.id));
      }

      res.status(201).json(inserted[0]);
      return;
    }

    if (req.method === "PATCH") {
      const parsed = updatePerformedRepBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: getZodErrorMessage(parsed.error) });
        return;
      }
      const result = await updatePerformedRepAndPoints(userId, parsed.data);
      if (!result) {
        res.status(404).json({ error: "Performed rep not found" });
        return;
      }
      res.status(200).json(result);
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling performed reps endpoint:", error);
    res.status(500).json({ error: "Failed to handle performed reps endpoint" });
  }
}
