import { and, asc, eq } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  programs,
  treatmentPlanExercises,
  treatmentPlans,
  userProfiles,
} from "./db/schema.js";
import {
  recordProgramHistorySnapshot,
  recordUserSessionHistorySnapshot,
} from "./prescription-history-service.js";
import { applyTreatmentPlanToTodaySchedule } from "./today-reps-service.js";
import type { z } from "zod";
import type {
  saveTreatmentPlanBodySchema,
  treatmentPlanExerciseInputSchema,
} from "../src/lib/validation.js";

type TreatmentPlanExerciseInput = z.infer<typeof treatmentPlanExerciseInputSchema>;
type SaveTreatmentPlanBody = z.infer<typeof saveTreatmentPlanBodySchema>;

export async function getTreatmentPlanForUser(userId: string) {
  const profileRows = await db
    .select({
      numberOfSessions: userProfiles.numberOfSessions,
    })
    .from(userProfiles)
    .where(eq(userProfiles.workosUserId, userId))
    .limit(1);

  const profile = profileRows[0];
  if (!profile) {
    return null;
  }

  const latestPlanRows = await db
    .select({
      id: treatmentPlans.id,
      numberOfSessions: treatmentPlans.numberOfSessions,
      effectiveFrom: treatmentPlans.effectiveFrom,
      createdAt: treatmentPlans.createdAt,
    })
    .from(treatmentPlans)
    .where(eq(treatmentPlans.userId, userId))
    .orderBy(asc(treatmentPlans.effectiveFrom), asc(treatmentPlans.id));

  const latestPlan = latestPlanRows[latestPlanRows.length - 1] ?? null;

  const activePrograms = await db
    .select({
      id: programs.id,
      exerciseName: programs.exerciseName,
      numberOfSeconds: programs.numberOfSeconds,
      numberOfRepetions: programs.numberOfRepetions,
      metronomeBpm: programs.metronomeBpm,
      position: programs.position,
      background: programs.background,
      recomendedVAS: programs.recomendedVAS,
    })
    .from(programs)
    .where(and(eq(programs.userId, userId), eq(programs.active, true)))
    .orderBy(programs.createdAt, programs.id);

  return {
    plan: latestPlan
      ? {
          id: latestPlan.id,
          numberOfSessions: latestPlan.numberOfSessions,
          effectiveFrom: latestPlan.effectiveFrom.toISOString(),
          createdAt: latestPlan.createdAt.toISOString(),
        }
      : null,
    numberOfSessions: profile.numberOfSessions,
    exercises: activePrograms.map((program) => ({
      id: program.id,
      programId: program.id,
      exerciseName: program.exerciseName,
      numberOfSeconds: program.numberOfSeconds,
      numberOfRepetions: program.numberOfRepetions,
      metronomeBpm: program.metronomeBpm,
      position: program.position,
      background: program.background,
      recomendedVAS: program.recomendedVAS,
    })),
  };
}

async function syncActiveProgramsForUser(
  userId: string,
  exercises: TreatmentPlanExerciseInput[],
) {
  const existingPrograms = await db
    .select({
      id: programs.id,
      exerciseName: programs.exerciseName,
      numberOfSeconds: programs.numberOfSeconds,
      numberOfRepetions: programs.numberOfRepetions,
      metronomeBpm: programs.metronomeBpm,
      position: programs.position,
      background: programs.background,
      recomendedVAS: programs.recomendedVAS,
      active: programs.active,
    })
    .from(programs)
    .where(eq(programs.userId, userId));

  const existingByName = new Map(
    existingPrograms.map((program) => [program.exerciseName, program]),
  );
  const nextExerciseNames = new Set<string>(
    exercises.map((exercise) => exercise.exerciseName),
  );
  const updatedPrograms: Array<{
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
    const existing = existingByName.get(exercise.exerciseName);
    if (existing) {
      const hasChanges =
        existing.numberOfSeconds !== exercise.numberOfSeconds ||
        existing.numberOfRepetions !== exercise.numberOfRepetions ||
        existing.metronomeBpm !== exercise.metronomeBpm ||
        existing.position !== exercise.position ||
        existing.background !== exercise.background ||
        existing.recomendedVAS !== exercise.recomendedVAS ||
        !existing.active;

      if (hasChanges) {
        const updated = await db
          .update(programs)
          .set({
            numberOfSeconds: exercise.numberOfSeconds,
            numberOfRepetions: exercise.numberOfRepetions,
            metronomeBpm: exercise.metronomeBpm,
            metronomeBpmTemp: null,
            position: exercise.position,
            background: exercise.background,
            recomendedVAS: exercise.recomendedVAS,
            active: true,
          })
          .where(eq(programs.id, existing.id))
          .returning();

        const updatedRow = updated[0];
        if (updatedRow) {
          await recordProgramHistorySnapshot(updatedRow.id);
          updatedPrograms.push({
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
        updatedPrograms.push({
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
      .insert(programs)
      .values({
        userId,
        exerciseName: exercise.exerciseName,
        numberOfSeconds: exercise.numberOfSeconds,
        numberOfRepetions: exercise.numberOfRepetions,
        metronomeBpm: exercise.metronomeBpm,
        position: exercise.position,
        background: exercise.background,
        recomendedVAS: exercise.recomendedVAS,
        active: true,
      })
      .returning();

    const insertedRow = inserted[0];
    if (insertedRow) {
      await recordProgramHistorySnapshot(insertedRow.id);
      updatedPrograms.push({
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

  for (const existing of existingPrograms) {
    if (nextExerciseNames.has(existing.exerciseName) || !existing.active) {
      continue;
    }

    await db.update(programs).set({ active: false }).where(eq(programs.id, existing.id));
    await recordProgramHistorySnapshot(existing.id);
  }

  return updatedPrograms;
}

export async function saveTreatmentPlanForUser(
  clinicianUserId: string,
  body: SaveTreatmentPlanBody,
) {
  const effectiveFrom = new Date();
  const { userId, timeZone, numberOfSessions, exercises } = body;

  const planInsert = await db
    .insert(treatmentPlans)
    .values({
      userId,
      createdBy: clinicianUserId,
      numberOfSessions,
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
      exerciseName: exercise.exerciseName,
      numberOfSeconds: exercise.numberOfSeconds,
      numberOfRepetions: exercise.numberOfRepetions,
      metronomeBpm: exercise.metronomeBpm,
      position: exercise.position,
      background: exercise.background,
      recomendedVAS: exercise.recomendedVAS,
    })),
  );

  const profileRows = await db
    .select({
      numberOfSessions: userProfiles.numberOfSessions,
    })
    .from(userProfiles)
    .where(eq(userProfiles.workosUserId, userId))
    .limit(1);

  const previousSessions = profileRows[0]?.numberOfSessions ?? 1;

  await db
    .update(userProfiles)
    .set({ numberOfSessions })
    .where(eq(userProfiles.workosUserId, userId));

  if (previousSessions !== numberOfSessions) {
    await recordUserSessionHistorySnapshot(userId, numberOfSessions, effectiveFrom);
  }

  const activePrograms = await syncActiveProgramsForUser(userId, exercises);
  await applyTreatmentPlanToTodaySchedule(userId, timeZone);

  return {
    planId,
    numberOfSessions,
    exercises: activePrograms,
  };
}
