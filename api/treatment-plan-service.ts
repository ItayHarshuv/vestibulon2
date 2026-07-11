import { and, asc, eq } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  prescribedExercises,
  treatmentPlanExercises,
  treatmentPlans,
  users,
} from "./db/schema.js";
import {
  recordPrescribedExerciseHistorySnapshot,
  recordUserSessionHistorySnapshot,
} from "./prescription-history-service.js";
import {
  applyTreatmentPlanToTodaySchedule,
} from "./today-reps-service.js";
import type { z } from "zod";
import type {
  saveTreatmentPlanBodySchema,
  treatmentPlanExerciseInputSchema,
} from "../src/lib/validation.js";

type TreatmentPlanExerciseInput = z.infer<typeof treatmentPlanExerciseInputSchema>;
type SaveTreatmentPlanBody = z.infer<typeof saveTreatmentPlanBodySchema>;

function mapPrescribedExerciseToTreatmentPlanExercise(
  prescribedExercise: {
    id: number;
    exerciseName: string;
    numberOfSeconds: number;
    numberOfRepetions: number;
    metronomeBpm: number;
    position: string;
    background: string;
    recomendedVAS: number;
  },
) {
  return {
    id: prescribedExercise.id,
    prescribedExerciseId: prescribedExercise.id,
    exerciseCode: prescribedExercise.exerciseName,
    secondsPerRep: prescribedExercise.numberOfSeconds,
    repsPerSession: prescribedExercise.numberOfRepetions,
    targetBpm: prescribedExercise.metronomeBpm,
    position: prescribedExercise.position,
    background: prescribedExercise.background,
    recommendedVAS: prescribedExercise.recomendedVAS,
  };
}

export async function getTreatmentPlanForUser(patientUserId: string) {
  const profileRows = await db
    .select({
      numberOfSessions: users.numberOfSessions,
    })
    .from(users)
    .where(eq(users.workosUserId, patientUserId))
    .limit(1);

  const profile = profileRows[0];
  if (!profile) {
    return null;
  }

  const latestPlanRows = await db
    .select({
      id: treatmentPlans.id,
      sessionsPerDay: treatmentPlans.sessionsPerDay,
      effectiveFrom: treatmentPlans.effectiveFrom,
      createdAt: treatmentPlans.createdAt,
    })
    .from(treatmentPlans)
    .where(eq(treatmentPlans.patientUserId, patientUserId))
    .orderBy(asc(treatmentPlans.effectiveFrom), asc(treatmentPlans.id));

  const latestPlan = latestPlanRows[latestPlanRows.length - 1] ?? null;

  const activePrescribedExercises = await db
    .select({
      id: prescribedExercises.id,
      exerciseName: prescribedExercises.exerciseName,
      numberOfSeconds: prescribedExercises.numberOfSeconds,
      numberOfRepetions: prescribedExercises.numberOfRepetions,
      metronomeBpm: prescribedExercises.metronomeBpm,
      position: prescribedExercises.position,
      background: prescribedExercises.background,
      recomendedVAS: prescribedExercises.recomendedVAS,
    })
    .from(prescribedExercises)
    .where(and(eq(prescribedExercises.userId, patientUserId), eq(prescribedExercises.active, true)))
    .orderBy(prescribedExercises.createdAt, prescribedExercises.id);

  return {
    plan: latestPlan
      ? {
          id: latestPlan.id,
          sessionsPerDay: latestPlan.sessionsPerDay,
          effectiveFrom: latestPlan.effectiveFrom.toISOString(),
          createdAt: latestPlan.createdAt.toISOString(),
        }
      : null,
    sessionsPerDay: profile.numberOfSessions,
    exercises: activePrescribedExercises.map(mapPrescribedExerciseToTreatmentPlanExercise),
  };
}

async function syncActivePrescribedExercisesForUser(
  userId: string,
  exercises: TreatmentPlanExerciseInput[],
) {
  const existingPrescribedExercises = await db
    .select({
      id: prescribedExercises.id,
      exerciseName: prescribedExercises.exerciseName,
      numberOfSeconds: prescribedExercises.numberOfSeconds,
      numberOfRepetions: prescribedExercises.numberOfRepetions,
      metronomeBpm: prescribedExercises.metronomeBpm,
      position: prescribedExercises.position,
      background: prescribedExercises.background,
      recomendedVAS: prescribedExercises.recomendedVAS,
      active: prescribedExercises.active,
    })
    .from(prescribedExercises)
    .where(eq(prescribedExercises.userId, userId));

  const existingByName = new Map(
    existingPrescribedExercises.map((prescribedExercise) => [prescribedExercise.exerciseName, prescribedExercise]),
  );
  const nextExerciseNames = new Set<string>(
    exercises.map((exercise) => exercise.exerciseCode),
  );
  const updatedPrescribedExercises: Array<{
    id: number;
    exerciseName: string;
    numberOfSeconds: number;
    numberOfRepetions: number;
    metronomeBpm: number;
    metronomeBpmTemp: number | null;
    position: string;
    background: string;
    recomendedVAS: number;
  }> = [];

  for (const exercise of exercises) {
    const existing = existingByName.get(exercise.exerciseCode);
    if (existing) {
      const hasChanges =
        existing.numberOfSeconds !== exercise.secondsPerRep ||
        existing.numberOfRepetions !== exercise.repsPerSession ||
        existing.metronomeBpm !== exercise.targetBpm ||
        existing.position !== exercise.position ||
        existing.background !== exercise.background ||
        existing.recomendedVAS !== exercise.recommendedVAS ||
        !existing.active;

      if (hasChanges) {
        const updated = await db
          .update(prescribedExercises)
          .set({
            numberOfSeconds: exercise.secondsPerRep,
            numberOfRepetions: exercise.repsPerSession,
            metronomeBpm: exercise.targetBpm,
            metronomeBpmTemp: null,
            position: exercise.position,
            background: exercise.background,
            recomendedVAS: exercise.recommendedVAS,
            active: true,
          })
          .where(eq(prescribedExercises.id, existing.id))
          .returning();

        const updatedRow = updated[0];
        if (updatedRow) {
          await recordPrescribedExerciseHistorySnapshot(updatedRow.id);
          updatedPrescribedExercises.push({
            id: updatedRow.id,
            exerciseName: updatedRow.exerciseName,
            numberOfSeconds: updatedRow.numberOfSeconds,
            numberOfRepetions: updatedRow.numberOfRepetions,
            metronomeBpm: updatedRow.metronomeBpm,
            metronomeBpmTemp: updatedRow.metronomeBpmTemp,
            position: updatedRow.position,
            background: updatedRow.background,
            recomendedVAS: updatedRow.recomendedVAS,
          });
        }
      } else {
        updatedPrescribedExercises.push({
          id: existing.id,
          exerciseName: existing.exerciseName,
          numberOfSeconds: existing.numberOfSeconds,
          numberOfRepetions: existing.numberOfRepetions,
          metronomeBpm: existing.metronomeBpm,
          metronomeBpmTemp: null,
          position: existing.position,
          background: existing.background,
          recomendedVAS: existing.recomendedVAS,
        });
      }

      continue;
    }

    const inserted = await db
      .insert(prescribedExercises)
      .values({
        userId,
        exerciseName: exercise.exerciseCode,
        numberOfSeconds: exercise.secondsPerRep,
        numberOfRepetions: exercise.repsPerSession,
        metronomeBpm: exercise.targetBpm,
        position: exercise.position,
        background: exercise.background,
        recomendedVAS: exercise.recommendedVAS,
        active: true,
      })
      .returning();

    const insertedRow = inserted[0];
    if (insertedRow) {
      await recordPrescribedExerciseHistorySnapshot(insertedRow.id);
      updatedPrescribedExercises.push({
        id: insertedRow.id,
        exerciseName: insertedRow.exerciseName,
        numberOfSeconds: insertedRow.numberOfSeconds,
        numberOfRepetions: insertedRow.numberOfRepetions,
        metronomeBpm: insertedRow.metronomeBpm,
        metronomeBpmTemp: insertedRow.metronomeBpmTemp,
        position: insertedRow.position,
        background: insertedRow.background,
        recomendedVAS: insertedRow.recomendedVAS,
      });
    }
  }

  for (const existing of existingPrescribedExercises) {
    if (nextExerciseNames.has(existing.exerciseName) || !existing.active) {
      continue;
    }

    await db.update(prescribedExercises).set({ active: false }).where(eq(prescribedExercises.id, existing.id));
    await recordPrescribedExerciseHistorySnapshot(existing.id);
  }

  return updatedPrescribedExercises;
}

export async function saveTreatmentPlanForUser(
  clinicianUserId: string,
  body: SaveTreatmentPlanBody,
) {
  const effectiveFrom = new Date();
  const { patientUserId, timeZone, sessionsPerDay, exercises } = body;

  const planInsert = await db
    .insert(treatmentPlans)
    .values({
      patientUserId,
      clinicianUserId,
      sessionsPerDay,
      effectiveFrom,
    })
    .returning();

  const planId = planInsert[0]?.id;
  if (!planId) {
    throw new Error("Failed to create treatment plan version");
  }

  await db.insert(treatmentPlanExercises).values(
    exercises.map((exercise) => ({
      treatmentPlanId: planId,
      exerciseCode: exercise.exerciseCode,
      secondsPerRep: exercise.secondsPerRep,
      repsPerSession: exercise.repsPerSession,
      targetBpm: exercise.targetBpm,
      position: exercise.position,
      background: exercise.background,
      recommendedVAS: exercise.recommendedVAS,
    })),
  );

  const profileRows = await db
    .select({
      numberOfSessions: users.numberOfSessions,
    })
    .from(users)
    .where(eq(users.workosUserId, patientUserId))
    .limit(1);

  const previousSessions = profileRows[0]?.numberOfSessions ?? 1;

  await db
    .update(users)
    .set({ numberOfSessions: sessionsPerDay })
    .where(eq(users.workosUserId, patientUserId));

  if (previousSessions !== sessionsPerDay) {
    await recordUserSessionHistorySnapshot(patientUserId, sessionsPerDay, effectiveFrom);
  }

  const activePrescribedExercises = await syncActivePrescribedExercisesForUser(patientUserId, exercises);
  await applyTreatmentPlanToTodaySchedule(patientUserId, timeZone);

  return {
    planId,
    sessionsPerDay,
    exercises: activePrescribedExercises.map(mapPrescribedExerciseToTreatmentPlanExercise),
  };
}
