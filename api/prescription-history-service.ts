import { asc, eq, inArray } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  prescribedExerciseHistory,
  prescribedExercises,
  users,
  userSessionHistory,
} from "./db/schema.js";

export async function recordPrescribedExerciseHistorySnapshot(
  prescribedExerciseId: number,
  effectiveFrom: Date = new Date(),
) {
  const rows = await db
    .select({
      id: prescribedExercises.id,
      userId: prescribedExercises.userId,
      exerciseName: prescribedExercises.exerciseName,
      numberOfRepetions: prescribedExercises.numberOfRepetions,
      active: prescribedExercises.active,
    })
    .from(prescribedExercises)
    .where(eq(prescribedExercises.id, prescribedExerciseId))
    .limit(1);

  const prescribedExercise = rows[0];
  if (!prescribedExercise) {
    return;
  }

  const latestHistory = await db
    .select({
      numberOfRepetions: prescribedExerciseHistory.numberOfRepetions,
      active: prescribedExerciseHistory.active,
      exerciseName: prescribedExerciseHistory.exerciseName,
    })
    .from(prescribedExerciseHistory)
    .where(eq(prescribedExerciseHistory.prescribedExerciseId, prescribedExerciseId))
    .orderBy(asc(prescribedExerciseHistory.effectiveFrom), asc(prescribedExerciseHistory.id));

  const lastSnapshot = latestHistory[latestHistory.length - 1];
  if (
    lastSnapshot?.numberOfRepetions === prescribedExercise.numberOfRepetions &&
    lastSnapshot.active === prescribedExercise.active &&
    lastSnapshot.exerciseName === prescribedExercise.exerciseName
  ) {
    return;
  }

  await db.insert(prescribedExerciseHistory).values({
    prescribedExerciseId: prescribedExercise.id,
    userId: prescribedExercise.userId,
    exerciseName: prescribedExercise.exerciseName,
    numberOfRepetions: prescribedExercise.numberOfRepetions,
    active: prescribedExercise.active,
    effectiveFrom,
  });
}

export async function recordUserSessionHistorySnapshot(
  userId: string,
  numberOfSessions: number,
  effectiveFrom: Date = new Date(),
) {
  const latestHistory = await db
    .select({
      numberOfSessions: userSessionHistory.numberOfSessions,
    })
    .from(userSessionHistory)
    .where(eq(userSessionHistory.userId, userId))
    .orderBy(asc(userSessionHistory.effectiveFrom), asc(userSessionHistory.id));

  const lastSnapshot = latestHistory[latestHistory.length - 1];
  if (lastSnapshot?.numberOfSessions === numberOfSessions) {
    return;
  }

  await db.insert(userSessionHistory).values({
    userId,
    numberOfSessions,
    effectiveFrom,
  });
}

export async function ensurePrescriptionHistoryForUser(userId: string) {
  const userRows = await db
    .select({
      numberOfSessions: users.numberOfSessions,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.workosUserId, userId))
    .limit(1);

  const userProfile = userRows[0];
  if (!userProfile) {
    return;
  }

  const existingSessionHistory = await db
    .select({ id: userSessionHistory.id })
    .from(userSessionHistory)
    .where(eq(userSessionHistory.userId, userId))
    .limit(1);

  if (existingSessionHistory.length === 0) {
    await db.insert(userSessionHistory).values({
      userId,
      numberOfSessions: userProfile.numberOfSessions,
      effectiveFrom: userProfile.createdAt,
    });
  }

  const userPrescribedExercises = await db
    .select({
      id: prescribedExercises.id,
      createdAt: prescribedExercises.createdAt,
    })
    .from(prescribedExercises)
    .where(eq(prescribedExercises.userId, userId));

  if (userPrescribedExercises.length === 0) {
    return;
  }

  const prescribedExerciseIds = userPrescribedExercises.map((prescribedExercise) => prescribedExercise.id);
  const existingPrescribedExerciseHistory = await db
    .select({ prescribedExerciseId: prescribedExerciseHistory.prescribedExerciseId })
    .from(prescribedExerciseHistory)
    .where(inArray(prescribedExerciseHistory.prescribedExerciseId, prescribedExerciseIds));

  const prescribedExerciseIdsWithHistory = new Set(
    existingPrescribedExerciseHistory.map((row) => row.prescribedExerciseId),
  );

  for (const prescribedExercise of userPrescribedExercises) {
    if (prescribedExerciseIdsWithHistory.has(prescribedExercise.id)) {
      continue;
    }

    await recordPrescribedExerciseHistorySnapshot(prescribedExercise.id, prescribedExercise.createdAt);
  }
}
