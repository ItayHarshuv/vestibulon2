import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "./db/index.js";
import { programHistory, programs, reps, userSessionHistory } from "./db/schema.js";
import { ensurePrescriptionHistoryForUser } from "./prescription-history-service.js";
import {
  compareDateKeys,
  createEndOfDayInTimeZone,
  getDateKeyInTimeZone,
  listDateKeysInclusive,
} from "./timezone-utils.js";

type ProgramHistorySnapshot = {
  numberOfRepetions: number;
  active: boolean;
  effectiveFrom: Date;
};

type SessionSnapshot = {
  numberOfSessions: number;
  effectiveFrom: Date;
};

export type ExerciseStatisticsDay = {
  date: string;
  plannedReps: number;
  completedReps: number;
  completionPercentage: number;
};

export type ExerciseStatisticsSeries = {
  exerciseName: string;
  startDate: string;
  endDate: string;
  days: ExerciseStatisticsDay[];
};

function resolveSnapshotForDate<T extends { effectiveFrom: Date }>(
  snapshots: T[],
  dateKey: string,
  timeZone: string,
): T | null {
  if (snapshots.length === 0) {
    return null;
  }

  const endOfDay = createEndOfDayInTimeZone(dateKey, timeZone).getTime();
  let resolved: T | null = null;

  for (const snapshot of snapshots) {
    if (snapshot.effectiveFrom.getTime() <= endOfDay) {
      resolved = snapshot;
      continue;
    }

    break;
  }

  return resolved ?? snapshots[0] ?? null;
}

function getPlannedRepsForDay(
  programIds: number[],
  programSnapshotsByProgramId: Map<number, ProgramHistorySnapshot[]>,
  sessionSnapshots: SessionSnapshot[],
  dateKey: string,
  timeZone: string,
) {
  const sessionSnapshot = resolveSnapshotForDate(sessionSnapshots, dateKey, timeZone);
  const numberOfSessions = Math.max(sessionSnapshot?.numberOfSessions ?? 1, 1);

  let plannedReps = 0;

  for (const programId of programIds) {
    const snapshots = programSnapshotsByProgramId.get(programId) ?? [];
    const prescription = resolveSnapshotForDate(snapshots, dateKey, timeZone);

    if (!prescription?.active) {
      continue;
    }

    plannedReps += numberOfSessions * Math.max(prescription.numberOfRepetions, 0);
  }

  return plannedReps;
}

export async function getExerciseStatisticsForUser(
  userId: string,
  timeZone: string,
): Promise<ExerciseStatisticsSeries[]> {
  await ensurePrescriptionHistoryForUser(userId);

  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);

  const [programRows, historyRows, sessionHistoryRows, completedRepRows] =
    await Promise.all([
      db
        .select({
          id: programs.id,
          exerciseName: programs.exerciseName,
          createdAt: programs.createdAt,
        })
        .from(programs)
        .where(eq(programs.userId, userId))
        .orderBy(asc(programs.createdAt), asc(programs.id)),
      db
        .select({
          programId: programHistory.programId,
          exerciseName: programHistory.exerciseName,
          numberOfRepetions: programHistory.numberOfRepetions,
          active: programHistory.active,
          effectiveFrom: programHistory.effectiveFrom,
        })
        .from(programHistory)
        .where(eq(programHistory.userId, userId))
        .orderBy(asc(programHistory.effectiveFrom), asc(programHistory.id)),
      db
        .select({
          numberOfSessions: userSessionHistory.numberOfSessions,
          effectiveFrom: userSessionHistory.effectiveFrom,
        })
        .from(userSessionHistory)
        .where(eq(userSessionHistory.userId, userId))
        .orderBy(asc(userSessionHistory.effectiveFrom), asc(userSessionHistory.id)),
      db
        .select({
          exerciseName: reps.exerciseName,
          endTime: reps.endTime,
        })
        .from(reps)
        .where(and(eq(reps.userId, userId), isNotNull(reps.endTime)))
        .orderBy(asc(reps.endTime), asc(reps.id)),
    ]);

  const programSnapshotsByProgramId = new Map<number, ProgramHistorySnapshot[]>();
  const programIdsByExerciseName = new Map<string, number[]>();

  for (const program of programRows) {
    const programIds = programIdsByExerciseName.get(program.exerciseName) ?? [];
    programIds.push(program.id);
    programIdsByExerciseName.set(program.exerciseName, programIds);
  }

  for (const row of historyRows) {
    const snapshots = programSnapshotsByProgramId.get(row.programId) ?? [];
    snapshots.push({
      numberOfRepetions: row.numberOfRepetions,
      active: row.active,
      effectiveFrom: row.effectiveFrom,
    });
    programSnapshotsByProgramId.set(row.programId, snapshots);

    if (!programIdsByExerciseName.has(row.exerciseName)) {
      programIdsByExerciseName.set(row.exerciseName, [row.programId]);
    }
  }

  const completedRepsByExerciseAndDate = new Map<string, Map<string, number>>();

  for (const row of completedRepRows) {
    if (!row.endTime) {
      continue;
    }

    const dateKey = getDateKeyInTimeZone(row.endTime, timeZone);
    const exerciseCounts =
      completedRepsByExerciseAndDate.get(row.exerciseName) ?? new Map<string, number>();
    exerciseCounts.set(dateKey, (exerciseCounts.get(dateKey) ?? 0) + 1);
    completedRepsByExerciseAndDate.set(row.exerciseName, exerciseCounts);
    if (!programIdsByExerciseName.has(row.exerciseName)) {
      programIdsByExerciseName.set(row.exerciseName, []);
    }
  }

  const exerciseNames = [...programIdsByExerciseName.keys()].sort((left, right) =>
    left.localeCompare(right, "he"),
  );

  const programCreatedAtByExercise = new Map<string, string>();
  for (const program of programRows) {
    const createdKey = getDateKeyInTimeZone(program.createdAt, timeZone);
    const existingKey = programCreatedAtByExercise.get(program.exerciseName);
    if (!existingKey || compareDateKeys(createdKey, existingKey) < 0) {
      programCreatedAtByExercise.set(program.exerciseName, createdKey);
    }
  }

  return exerciseNames.map((exerciseName) => {
    const programIds = programIdsByExerciseName.get(exerciseName) ?? [];
    const repDates = [...(completedRepsByExerciseAndDate.get(exerciseName)?.keys() ?? [])];
    const firstRepDate = repDates.sort(compareDateKeys)[0] ?? null;
    const programStartDate = programCreatedAtByExercise.get(exerciseName) ?? todayKey;
    const startDate =
      firstRepDate && compareDateKeys(firstRepDate, programStartDate) < 0
        ? firstRepDate
        : programStartDate;
    const endDate = todayKey;

    const days = listDateKeysInclusive(startDate, endDate).map((dateKey) => {
      const plannedReps = getPlannedRepsForDay(
        programIds,
        programSnapshotsByProgramId,
        sessionHistoryRows,
        dateKey,
        timeZone,
      );
      const completedReps =
        completedRepsByExerciseAndDate.get(exerciseName)?.get(dateKey) ?? 0;
      const completionPercentage =
        plannedReps > 0
          ? Math.min(100, Math.round((completedReps / plannedReps) * 100))
          : 0;

      return {
        date: dateKey,
        plannedReps,
        completedReps,
        completionPercentage,
      };
    });

    return {
      exerciseName,
      startDate,
      endDate,
      days,
    };
  });
}
