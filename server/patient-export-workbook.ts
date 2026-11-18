import ExcelJS from "exceljs";
import {
  allBackgrounds,
  allExPositions,
  exerciseTemplateNames,
} from "../src/data/content.js";
import type {
  performedReps,
  treatmentPlanExercises,
  treatmentPlans,
} from "./db/schema.js";
import type { ExerciseStatisticsSeries } from "./exercise-statistics-service.js";

type Plan = typeof treatmentPlans.$inferSelect;
type Exercise = typeof treatmentPlanExercises.$inferSelect;
type Repetition = typeof performedReps.$inferSelect;

export type PatientExportData = {
  username: string;
  plans: Plan[];
  exercises: Exercise[];
  repetitions: Repetition[];
  statistics: ExerciseStatisticsSeries[];
};

// Preserve the legacy column names (including spelling) for existing analyses.
const planHeaders = [
  "UserCode",
  "WhichPatient",
  "ExerciseProgramNumber",
  "TimeStamp",
  "FlagProgramChange",
  "NumberOfExercises",
  "ExerciseName",
  "RepetitionDurationRequiredSeconds",
  "SessionsRequiredPerDay",
  "NumberRepsRequiredPerSession",
  "BackgroundName",
  "PositionName",
  "BPM_Required",
  "VAS_Required",
];
const repetitionHeaders = [
  "UserCode",
  "ExerciseName",
  "TimeStamp_StartRepetition",
  "TimeStamp_EndRepetition",
  "RepetitionDurationRequiredSeconds",
  "DurationRecoverySeconds",
  "SessionCurrentDay",
  "SessionsRequiredPerDay",
  "ReptetionNumber",
  "NumberRepsRequiredPerSession",
  "BackgroundName",
  "PositionName",
  "BPM_EndOfRep",
  "BPM_Required",
  "VAS_Nausea",
  "VAS_Dizziness",
  "VAS_Difficulty",
  "VAS_Required",
  "Flag_InterruptionOccured",
  "Flag_PausedRepetition",
];
const statisticsHeaders = [
  "UserCode",
  "WhichPatient",
  ...Array.from({ length: 8 }, (_, i) => `ComplianceRateExercise${i + 1}`),
  "AverageComplianceRate",
  "AverageDizziness",
  "AverageNausea",
  "AverageDifficulty",
  "AverageDizzinessRatio",
  "AverageNauseaRatio",
  "AverageDifficultyRatio",
  "startDate",
  "endDate",
];

function legacyCode(values: readonly string[], value: string | undefined) {
  return value === undefined ? null : values.indexOf(value) + 1;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function average(values: number[]) {
  return values.length
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
}

export function createPatientExportWorkbook(
  clinicianUsername: string,
  patients: PatientExportData[],
  timeZone: string,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vestibulon";
  workbook.subject = "CliniqueDataFile";
  const timestampFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  function timestamp(value: Date | null) {
    if (!value) return null;
    const parts = timestampFormatter.formatToParts(value);
    return ["year", "month", "day", "hour", "minute", "second"]
      .map((type) => parts.find((part) => part.type === type)?.value ?? "")
      .join("");
  }
  function addSheet(requestedName: string, headers: string[]) {
    // Excel limits names to 31 characters; usernames may contain reserved characters.
    const base =
      requestedName
        .replace(/[\\/*?:\[\]\x00-\x1f]/g, "_")
        .replace(/^'+|'+$/g, "") || "Patient";
    let name = base.slice(0, 31).replace(/'+$/g, "");
    let suffix = 1;
    while (
      name.toLowerCase() === "history" ||
      workbook.worksheets.some(
        (sheet) => sheet.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      const ending = ` (${suffix++})`;
      name = base.slice(0, 31 - ending.length) + ending;
    }
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column, index) => {
      column.width = Math.min(
        42,
        Math.max(18, (headers[index]?.length ?? 16) + 2),
      );
    });
    return sheet;
  }

  const planSheet = addSheet(`${clinicianUsername} Clinique info`, planHeaders);
  addSheet("Notifications Info", [
    "UserCode",
    "WhichPatient",
    "TimeStemp_ReviewNotifications",
    "TimeStemp_MessageNotifications",
  ]);
  const followUpSheet = addSheet(`Follow-ups by ${clinicianUsername}`, [
    "UserCode",
    "WhichPatient",
    "AppTimeUsage",
    "TotalNotificationSent",
    "TotalReviewsOfPracticeData",
  ]);
  const statisticsSheet = addSheet("Patients Statistics", statisticsHeaders);

  for (const patient of patients) {
    followUpSheet.addRow([
      clinicianUsername,
      patient.username,
      null,
      null,
      null,
    ]);
    const exerciseById = new Map(
      patient.exercises.map((exercise) => [exercise.id, exercise]),
    );
    const planById = new Map(patient.plans.map((plan) => [plan.id, plan]));
    let previousExercises: Exercise[] = [];
    let previousSessions: number | null = null;
    patient.plans.forEach((plan, index) => {
      const exercises = patient.exercises.filter(
        (exercise) => exercise.treatmentPlanId === plan.id,
      );
      for (const exercise of exercises) {
        const previous = previousExercises.find(
          (item) => item.exerciseCode === exercise.exerciseCode,
        );
        const unchanged =
          previous &&
          previousSessions === plan.sessionsPerDay &&
          (
            [
              "secondsPerRep",
              "repsPerSession",
              "targetBpm",
              "position",
              "background",
              "recommendedVAS",
            ] as const
          ).every((key) => previous[key] === exercise[key]);
        planSheet.addRow([
          clinicianUsername,
          patient.username,
          index + 1,
          timestamp(plan.createdAt),
          unchanged ? 0 : 1,
          exercises.length,
          legacyCode(exerciseTemplateNames, exercise.exerciseCode),
          exercise.secondsPerRep,
          plan.sessionsPerDay,
          exercise.repsPerSession,
          legacyCode(allBackgrounds, exercise.background),
          legacyCode(allExPositions, exercise.position),
          exercise.targetBpm,
          exercise.recommendedVAS,
        ]);
      }
      for (const removed of previousExercises.filter(
        (previous) =>
          !exercises.some(
            (exercise) => exercise.exerciseCode === previous.exerciseCode,
          ),
      )) {
        planSheet.addRow([
          clinicianUsername,
          patient.username,
          index + 1,
          timestamp(plan.createdAt),
          1,
          0,
          legacyCode(exerciseTemplateNames, removed.exerciseCode),
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ]);
      }
      previousExercises = exercises;
      previousSessions = plan.sessionsPerDay;
    });

    const patientSheet = addSheet(patient.username, repetitionHeaders);
    const completed = patient.repetitions.filter((rep) => rep.endTime !== null);
    for (const rep of completed) {
      const exercise =
        rep.treatmentPlanExerciseId === null
          ? undefined
          : exerciseById.get(rep.treatmentPlanExerciseId);
      const plan = exercise
        ? planById.get(exercise.treatmentPlanId)
        : undefined;
      patientSheet.addRow([
        patient.username,
        legacyCode(exerciseTemplateNames, exercise?.exerciseCode),
        timestamp(rep.startTime),
        timestamp(rep.endTime),
        exercise?.secondsPerRep ?? null,
        rep.restTime,
        rep.sessionIndex,
        plan?.sessionsPerDay ?? null,
        rep.repIndex,
        exercise?.repsPerSession ?? null,
        legacyCode(allBackgrounds, exercise?.background),
        legacyCode(allExPositions, exercise?.position),
        rep.bpmEndOfRep,
        exercise?.targetBpm ?? null,
        rep.nausea,
        rep.dizziness,
        rep.generalDifficulty,
        exercise?.recommendedVAS ?? null,
        Number(rep.flagInterrupted ?? false),
        Number(rep.flagPaused ?? false),
      ]);
    }

    const rates = new Map(
      patient.statistics.map((series) => {
        const planned = series.days.reduce(
          (sum, day) => sum + day.plannedReps,
          0,
        );
        const done = series.days.reduce(
          (sum, day) => sum + day.completedReps,
          0,
        );
        return [series.exerciseName, planned ? round(done / planned) : null];
      }),
    );
    const scores = (key: "dizziness" | "nausea" | "generalDifficulty") =>
      completed.flatMap((rep) => (rep[key] === null ? [] : [rep[key]]));
    // Ratios use each repetition's prescribed VAS, so program changes don't
    // apply the latest prescription to older repetitions. Missing/zero targets
    // have no defined ratio and remain blank rather than producing Infinity.
    const ratios = (key: "dizziness" | "nausea" | "generalDifficulty") =>
      completed.flatMap((rep) => {
        const target =
          rep.treatmentPlanExerciseId === null
            ? undefined
            : exerciseById.get(rep.treatmentPlanExerciseId)?.recommendedVAS;
        return rep[key] !== null && target ? [rep[key] / target] : [];
      });
    const dates = patient.statistics
      .flatMap((series) => series.days.map((day) => day.date))
      .sort();
    const displayDate = (date: string | undefined) =>
      date
        ? `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}/${date.slice(2, 4)}`
        : null;
    statisticsSheet.addRow([
      clinicianUsername,
      patient.username,
      ...exerciseTemplateNames
        .slice(0, 8)
        .map((name) => rates.get(name) ?? null),
      average(
        [...rates.values()].filter((rate): rate is number => rate !== null),
      ),
      average(scores("dizziness")),
      average(scores("nausea")),
      average(scores("generalDifficulty")),
      average(ratios("dizziness")),
      average(ratios("nausea")),
      average(ratios("generalDifficulty")),
      displayDate(dates[0]),
      displayDate(dates.at(-1)),
    ]);
  }
  return workbook;
}
