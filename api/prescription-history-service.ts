import { asc, eq, inArray } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  programHistory,
  programs,
  userProfiles,
  userSessionHistory,
} from "./db/schema.js";

export async function recordProgramHistorySnapshot(
  programId: number,
  effectiveFrom: Date = new Date(),
) {
  const rows = await db
    .select({
      id: programs.id,
      userId: programs.userId,
      exerciseName: programs.exerciseName,
      numberOfRepetions: programs.numberOfRepetions,
      active: programs.active,
    })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);

  const program = rows[0];
  if (!program) {
    return;
  }

  const latestHistory = await db
    .select({
      numberOfRepetions: programHistory.numberOfRepetions,
      active: programHistory.active,
      exerciseName: programHistory.exerciseName,
    })
    .from(programHistory)
    .where(eq(programHistory.programId, programId))
    .orderBy(asc(programHistory.effectiveFrom), asc(programHistory.id));

  const lastSnapshot = latestHistory[latestHistory.length - 1];
  if (
    lastSnapshot?.numberOfRepetions === program.numberOfRepetions &&
    lastSnapshot.active === program.active &&
    lastSnapshot.exerciseName === program.exerciseName
  ) {
    return;
  }

  await db.insert(programHistory).values({
    programId: program.id,
    userId: program.userId,
    exerciseName: program.exerciseName,
    numberOfRepetions: program.numberOfRepetions,
    active: program.active,
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
      numberOfSessions: userProfiles.numberOfSessions,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .where(eq(userProfiles.workosUserId, userId))
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

  const userPrograms = await db
    .select({
      id: programs.id,
      createdAt: programs.createdAt,
    })
    .from(programs)
    .where(eq(programs.userId, userId));

  if (userPrograms.length === 0) {
    return;
  }

  const programIds = userPrograms.map((program) => program.id);
  const existingProgramHistory = await db
    .select({ programId: programHistory.programId })
    .from(programHistory)
    .where(inArray(programHistory.programId, programIds));

  const programIdsWithHistory = new Set(
    existingProgramHistory.map((row) => row.programId),
  );

  for (const program of userPrograms) {
    if (programIdsWithHistory.has(program.id)) {
      continue;
    }

    await recordProgramHistorySnapshot(program.id, program.createdAt);
  }
}
