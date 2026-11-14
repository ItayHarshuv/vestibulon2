import { asc, eq, sql } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  sessionTimes,
  treatmentPlanExercises,
  treatmentPlans,
  users,
} from "./db/schema.js";
import { getPlanActivationBoundary } from "./daily-schedule-service.js";
import { ensureSessionTimesForUser } from "./session-times-service.js";
import { buildDefaultSessionTimes } from "./timezone-utils.js";
import type { z } from "zod";
import type { saveTreatmentPlanBodySchema } from "../src/lib/validation.js";

type SaveTreatmentPlanBody = z.infer<typeof saveTreatmentPlanBodySchema>;

export async function getTreatmentPlanForUser(userId: string) {
  const userRows = await db
    .select({ id: users.workosUserId })
    .from(users)
    .where(eq(users.workosUserId, userId))
    .limit(1);
  if (!userRows[0]) {
    return null;
  }

  const latestPlanRows = await db
    .select({
      id: treatmentPlans.id,
      sessionsPerDay: treatmentPlans.sessionsPerDay,
      effectiveDate: treatmentPlans.effectiveDate,
      effectiveSessionIndex: treatmentPlans.effectiveSessionIndex,
      createdAt: treatmentPlans.createdAt,
    })
    .from(treatmentPlans)
    .where(eq(treatmentPlans.patientUserId, userId))
    .orderBy(asc(treatmentPlans.createdAt), asc(treatmentPlans.id));

  const latestPlan = latestPlanRows[latestPlanRows.length - 1] ?? null;
  const exercises = latestPlan
    ? await db
        .select()
        .from(treatmentPlanExercises)
        .where(eq(treatmentPlanExercises.treatmentPlanId, latestPlan.id))
        .orderBy(asc(treatmentPlanExercises.id))
    : [];

  return {
    plan: latestPlan
      ? {
          id: latestPlan.id,
          numberOfSessions: latestPlan.sessionsPerDay,
          effectiveFrom: `${latestPlan.effectiveDate}T00:00:00.000Z`,
          createdAt: latestPlan.createdAt.toISOString(),
        }
      : null,
    numberOfSessions: latestPlan?.sessionsPerDay ?? 1,
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      prescribedExerciseId: exercise.id,
      exerciseName: exercise.exerciseCode,
      numberOfSeconds: exercise.secondsPerRep,
      numberOfRepetions: exercise.repsPerSession,
      metronomeBpm: exercise.targetBpm,
      position: exercise.position,
      background: exercise.background,
      recomendedVAS: exercise.recommendedVAS,
    })),
  };
}

export async function saveTreatmentPlanForUser(
  clinicianUserId: string,
  body: SaveTreatmentPlanBody,
) {
  const effectiveFrom = new Date();
  const { userId, timeZone, numberOfSessions, exercises } = body;
  const activation = await getPlanActivationBoundary(
    userId,
    timeZone,
    numberOfSessions,
  );
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const existingPlanRows = await tx
      .select({ sessionsPerDay: treatmentPlans.sessionsPerDay })
      .from(treatmentPlans)
      .where(eq(treatmentPlans.patientUserId, userId))
      .orderBy(asc(treatmentPlans.createdAt), asc(treatmentPlans.id));
    const previousSessionsPerDay =
      existingPlanRows.at(-1)?.sessionsPerDay ?? null;
    await tx
      .update(users)
      .set({ timeZone })
      .where(eq(users.workosUserId, userId));
    const planInsert = await tx
      .insert(treatmentPlans)
      .values({
        patientUserId: userId,
        clinicianUserId,
        sessionsPerDay: numberOfSessions,
        effectiveDate: activation.effectiveDate,
        effectiveSessionIndex: activation.effectiveSessionIndex,
        createdAt: effectiveFrom,
      })
      .returning();
    const planId = planInsert[0]?.id;
    if (!planId) throw new Error("Failed to create treatment plan version");
    const insertedExercises = await tx
      .insert(treatmentPlanExercises)
      .values(
        exercises.map((exercise) => ({
          treatmentPlanId: planId,
          exerciseCode: exercise.exerciseName,
          secondsPerRep: exercise.numberOfSeconds,
          repsPerSession: exercise.numberOfRepetions,
          targetBpm: exercise.metronomeBpm,
          position: exercise.position,
          background: exercise.background,
          recommendedVAS: exercise.recomendedVAS,
        })),
      )
      .returning();
    if (
      previousSessionsPerDay !== null &&
      previousSessionsPerDay !== numberOfSessions
    ) {
      await tx.delete(sessionTimes).where(eq(sessionTimes.userId, userId));
      await tx.insert(sessionTimes).values(
        buildDefaultSessionTimes(numberOfSessions).map((localTime, index) => ({
          userId,
          sessionIndex: index + 1,
          localTime,
        })),
      );
    }
    return { planId, insertedExercises };
  });
  await ensureSessionTimesForUser(userId, numberOfSessions, timeZone);

  return {
    planId: result.planId,
    numberOfSessions,
    exercises: result.insertedExercises.map((exercise) => ({
      id: exercise.id,
      treatmentPlanExerciseId: exercise.id,
      exerciseName: exercise.exerciseCode,
      numberOfSeconds: exercise.secondsPerRep,
      numberOfRepetions: exercise.repsPerSession,
      metronomeBpm: exercise.targetBpm,
      metronomeBpmTemp: null,
      position: exercise.position,
      background: exercise.background,
      recomendedVAS: exercise.recommendedVAS,
    })),
  };
}
