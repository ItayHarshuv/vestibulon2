import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  performedReps,
  prescribedExerciseHistory,
  prescribedExercises,
  userSessionHistory,
} from "./db/schema.js";
import { ensurePrescriptionHistoryForUser } from "./prescription-history-service.js";
import {
  compareDateKeys,
  createEndOfDayInTimeZone,
  getDateKeyInTimeZone,
  listDateKeysInclusive,
} from "./timezone-utils.js";

type PrescribedExerciseHistorySnapshot = {
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
  prescribedExerciseIds: number[],
  prescribedExerciseSnapshotsById: Map<number, PrescribedExerciseHistorySnapshot[]>,
  sessionSnapshots: SessionSnapshot[],
  dateKey: string,
  timeZone: string,
) {
  const sessionSnapshot = resolveSnapshotForDate(sessionSnapshots, dateKey, timeZone);
  const numberOfSessions = Math.max(sessionSnapshot?.numberOfSessions ?? 1, 1);

  let plannedReps = 0;

  for (const prescribedExerciseId of prescribedExerciseIds) {
    const snapshots = prescribedExerciseSnapshotsById.get(prescribedExerciseId) ?? [];
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

  const [prescribedExerciseRows, historyRows, sessionHistoryRows, completedPerformedRepRows] =
    await Promise.all([
      db
        .select({
          id: prescribedExercises.id,
          exerciseName: prescribedExercises.exerciseName,
          createdAt: prescribedExercises.createdAt,
        })
        .from(prescribedExercises)
        .where(eq(prescribedExercises.userId, userId))
        .orderBy(asc(prescribedExercises.createdAt), asc(prescribedExercises.id)),
      db
        .select({
          prescribedExerciseId: prescribedExerciseHistory.prescribedExerciseId,
          exerciseName: prescribedExerciseHistory.exerciseName,
          numberOfRepetions: prescribedExerciseHistory.numberOfRepetions,
          active: prescribedExerciseHistory.active,
          effectiveFrom: prescribedExerciseHistory.effectiveFrom,
        })
        .from(prescribedExerciseHistory)
        .where(eq(prescribedExerciseHistory.userId, userId))
        .orderBy(asc(prescribedExerciseHistory.effectiveFrom), asc(prescribedExerciseHistory.id)),
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
          exerciseName: performedReps.exerciseName,
          endTime: performedReps.endTime,
        })
        .from(performedReps)
        .where(and(eq(performedReps.userId, userId), isNotNull(performedReps.endTime)))
        .orderBy(asc(performedReps.endTime), asc(performedReps.id)),
    ]);

  const prescribedExerciseSnapshotsById = new Map<number, PrescribedExerciseHistorySnapshot[]>();
  const prescribedExerciseIdsByExerciseName = new Map<string, number[]>();

  for (const prescribedExercise of prescribedExerciseRows) {
    const prescribedExerciseIds = prescribedExerciseIdsByExerciseName.get(prescribedExercise.exerciseName) ?? [];
    prescribedExerciseIds.push(prescribedExercise.id);
    prescribedExerciseIdsByExerciseName.set(prescribedExercise.exerciseName, prescribedExerciseIds);
  }

  for (const row of historyRows) {
    const snapshots = prescribedExerciseSnapshotsById.get(row.prescribedExerciseId) ?? [];
    snapshots.push({
      numberOfRepetions: row.numberOfRepetions,
      active: row.active,
      effectiveFrom: row.effectiveFrom,
    });
    prescribedExerciseSnapshotsById.set(row.prescribedExerciseId, snapshots);

    if (!prescribedExerciseIdsByExerciseName.has(row.exerciseName)) {
      prescribedExerciseIdsByExerciseName.set(row.exerciseName, [row.prescribedExerciseId]);
    }
  }

  const completedRepsByExerciseAndDate = new Map<string, Map<string, number>>();

  for (const row of completedPerformedRepRows) {
    if (!row.endTime) {
      continue;
    }

    const dateKey = getDateKeyInTimeZone(row.endTime, timeZone);
    const exerciseCounts =
      completedRepsByExerciseAndDate.get(row.exerciseName) ?? new Map<string, number>();
    exerciseCounts.set(dateKey, (exerciseCounts.get(dateKey) ?? 0) + 1);
    completedRepsByExerciseAndDate.set(row.exerciseName, exerciseCounts);
    if (!prescribedExerciseIdsByExerciseName.has(row.exerciseName)) {
      prescribedExerciseIdsByExerciseName.set(row.exerciseName, []);
    }
  }

  const exerciseNames = [...prescribedExerciseIdsByExerciseName.keys()].sort((left, right) =>
    left.localeCompare(right, "he"),
  );

  const prescribedExerciseCreatedAtByExercise = new Map<string, string>();
  for (const prescribedExercise of prescribedExerciseRows) {
    const createdKey = getDateKeyInTimeZone(prescribedExercise.createdAt, timeZone);
    const existingKey = prescribedExerciseCreatedAtByExercise.get(prescribedExercise.exerciseName);
    if (!existingKey || compareDateKeys(createdKey, existingKey) < 0) {
      prescribedExerciseCreatedAtByExercise.set(prescribedExercise.exerciseName, createdKey);
    }
  }

  return exerciseNames.map((exerciseName) => {
    const prescribedExerciseIds = prescribedExerciseIdsByExerciseName.get(exerciseName) ?? [];
    const performedRepDates = [
      ...(completedRepsByExerciseAndDate.get(exerciseName)?.keys() ?? []),
    ];
    const firstPerformedRepDate =
      performedRepDates.sort(compareDateKeys)[0] ?? null;
    const prescribedExerciseStartDate = prescribedExerciseCreatedAtByExercise.get(exerciseName) ?? todayKey;
    const startDate =
      firstPerformedRepDate &&
      compareDateKeys(firstPerformedRepDate, prescribedExerciseStartDate) < 0
        ? firstPerformedRepDate
        : prescribedExerciseStartDate;
    const endDate = todayKey;

    const days = listDateKeysInclusive(startDate, endDate).map((dateKey) => {
      const plannedReps = getPlannedRepsForDay(
        prescribedExerciseIds,
        prescribedExerciseSnapshotsById,
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
