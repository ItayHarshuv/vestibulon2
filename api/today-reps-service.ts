import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "./db/index.js";
import { programs, todayReps } from "./db/schema.js";

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(
        (part): part is Intl.DateTimeFormatPart & {
          type: "year" | "month" | "day" | "hour" | "minute" | "second";
        } =>
          part.type === "year" ||
          part.type === "month" ||
          part.type === "day" ||
          part.type === "hour" ||
          part.type === "minute" ||
          part.type === "second",
      )
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function getDateKeyInTimeZone(date: Date, timeZone: string) {
  const { year, month, day } = getTimeZoneParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Convert a wall-clock time in the given timezone into a UTC Date for storage.
function createDateInTimeZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const observed = getTimeZoneParts(new Date(utcGuess), timeZone);
  const offsetMs =
    Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    ) - utcGuess;

  return new Date(utcGuess - offsetMs);
}

function roundToQuarterHour(totalMinutes: number) {
  return Math.round(totalMinutes / 15) * 15;
}

function buildPracticeTimes(totalRows: number, timeZone: string) {
  if (totalRows === 0) {
    return [];
  }

  const { year, month, day } = getTimeZoneParts(new Date(), timeZone);
  const startMinutes = 8 * 60;
  const endMinutes = 20 * 60;

  if (totalRows === 1) {
    return [createDateInTimeZone(year, month, day, 8, 0, timeZone)];
  }

  return Array.from({ length: totalRows }, (_, index) => {
    const totalSpanMinutes = endMinutes - startMinutes;
    const plannedMinutes =
      index === 0
        ? startMinutes
        : index === totalRows - 1
          ? endMinutes
          : roundToQuarterHour(
              startMinutes + (totalSpanMinutes * index) / (totalRows - 1),
            );

    return createDateInTimeZone(
      year,
      month,
      day,
      Math.floor(plannedMinutes / 60),
      plannedMinutes % 60,
      timeZone,
    );
  });
}

export async function ensureTodayRepsForUser(
  userId: string,
  timeZone: string,
) {
  getTimeZoneParts(new Date(), timeZone);

  const existingRows = await db
    .select({
      practiceTime: todayReps.practiceTime,
    })
    .from(todayReps)
    .where(eq(todayReps.userId, userId))
    .orderBy(asc(todayReps.practiceTime), asc(todayReps.id))
    .limit(1);

  const existingPracticeTime = existingRows[0]?.practiceTime ?? null;
  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
  const existingKey = existingPracticeTime
    ? getDateKeyInTimeZone(existingPracticeTime, timeZone)
    : null;

  if (existingKey === todayKey) {
    return { recreated: false, rowsCreated: 0 };
  }

  await db.delete(todayReps).where(eq(todayReps.userId, userId));

  const activePrograms = await db
    .select({
      exerciseName: programs.exerciseName,
      numberOfRepetions: programs.numberOfRepetions,
    })
    .from(programs)
    .where(and(eq(programs.userId, userId), eq(programs.active, true)))
    .orderBy(programs.createdAt, programs.id);

  const scheduledExerciseNames = activePrograms.flatMap((program) =>
    Array.from({ length: program.numberOfRepetions }, () => program.exerciseName),
  );

  if (scheduledExerciseNames.length === 0) {
    return { recreated: true, rowsCreated: 0 };
  }

  const practiceTimes = buildPracticeTimes(scheduledExerciseNames.length, timeZone);

  await db.insert(todayReps).values(
    scheduledExerciseNames.map((exerciseName, index) => ({
      userId,
      exerciseName,
      practiceTime: practiceTimes[index]!,
    })),
  );

  return { recreated: true, rowsCreated: scheduledExerciseNames.length };
}

export async function assignRepToTodayRepSlot(
  userId: string,
  exerciseName: string,
  repId: number,
) {
  const availableRows = await db
    .select({
      id: todayReps.id,
    })
    .from(todayReps)
    .where(
      and(
        eq(todayReps.userId, userId),
        eq(todayReps.exerciseName, exerciseName),
        isNull(todayReps.repId),
      ),
    )
    .orderBy(asc(todayReps.practiceTime), asc(todayReps.id))
    .limit(1);

  const row = availableRows[0];
  if (!row) {
    return false;
  }

  await db.update(todayReps).set({ repId }).where(eq(todayReps.id, row.id));
  return true;
}
