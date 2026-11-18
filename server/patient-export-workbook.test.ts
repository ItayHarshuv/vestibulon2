import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import {
  createPatientExportWorkbook,
  type PatientExportData,
} from "./patient-export-workbook.js";
import { allBackgrounds, allExPositions } from "../src/data/content.js";

function fixture(): PatientExportData {
  const plan = {
    id: 1,
    patientUserId: "patient-id",
    clinicianUserId: "clinician-id",
    sessionsPerDay: 2,
    effectiveDate: "2026-11-17",
    effectiveSessionIndex: 1,
    createdAt: new Date("2026-11-17T08:00:00Z"),
  };
  const exercise = {
    id: 1,
    treatmentPlanId: 1,
    exerciseCode: "VORx1",
    secondsPerRep: 30,
    repsPerSession: 3,
    targetBpm: 60,
    position: allExPositions[0],
    background: allBackgrounds[0],
    recommendedVAS: 2,
  };
  const rep = {
    id: 1,
    patientUserId: "patient-id",
    treatmentPlanExerciseId: 1,
    scheduledDate: "2026-11-17",
    sessionIndex: 1,
    repIndex: 1,
    scheduledAt: null,
    clientRequestId: null,
    dizziness: 0,
    nausea: 2,
    generalDifficulty: 0,
    restTime: 15,
    startTime: new Date("2026-11-17T08:00:00Z"),
    endTime: new Date("2026-11-17T08:00:30Z"),
    bpmEndOfRep: 65,
    flagInterrupted: false,
    flagPaused: true,
  };
  return {
    username: "מטופל",
    plans: [
      plan,
      { ...plan, id: 2, createdAt: new Date("2026-11-18T08:00:00Z") },
    ],
    exercises: [
      exercise,
      { ...exercise, id: 2, treatmentPlanId: 2, recommendedVAS: 4 },
    ],
    repetitions: [
      rep,
      {
        ...rep,
        id: 2,
        treatmentPlanExerciseId: 2,
        dizziness: 4,
        nausea: 0,
        generalDifficulty: 2,
      },
      { ...rep, id: 3, endTime: null },
    ],
    statistics: [
      {
        exerciseName: "VORx1",
        startDate: "2026-11-17",
        endDate: "2026-11-18",
        days: [
          {
            date: "2026-11-17",
            completedReps: 2,
            plannedReps: 6,
            completionPercentage: 33,
          },
          {
            date: "2026-11-18",
            completedReps: 0,
            plannedReps: 6,
            completionPercentage: 0,
          },
        ],
      },
    ],
  };
}

void test("exports legacy sheets and typed repetition cells, with blanks for unrecorded telemetry", async () => {
  const workbook = createPatientExportWorkbook(
    "doctor",
    [fixture()],
    "Asia/Jerusalem",
  );
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.deepEqual(
    reopened.worksheets.map((sheet) => sheet.name),
    [
      "doctor Clinique info",
      "Notifications Info",
      "Follow-ups by doctor",
      "Patients Statistics",
      "מטופל",
    ],
  );
  const sheet = reopened.getWorksheet("מטופל")!;
  assert.equal(sheet.rowCount, 3); // unfinished repetitions are excluded
  assert.deepEqual(
    Array.from(
      { length: sheet.columnCount },
      (_, i) => sheet.getRow(2).getCell(i + 1).value,
    ),
    [
      "מטופל",
      1,
      "261117100000",
      "261117100030",
      30,
      15,
      1,
      2,
      1,
      3,
      1,
      1,
      65,
      60,
      2,
      0,
      0,
      2,
      0,
      1,
    ],
  );
  assert.equal(reopened.getWorksheet("Notifications Info")!.rowCount, 1);
  const followUps = reopened.getWorksheet("Follow-ups by doctor")!;
  assert.equal(followUps.getCell("A2").value, "doctor");
  assert.equal(followUps.getCell("B2").value, "מטופל");
  for (const column of ["C", "D", "E"])
    assert.equal(followUps.getCell(`${column}2`).value, null);
});

void test("includes zero symptoms, averages per-repetition VAS ratios, and leaves undefined values blank", () => {
  const workbook = createPatientExportWorkbook("doctor", [fixture()], "UTC");
  const sheet = workbook.getWorksheet("Patients Statistics")!;
  assert.deepEqual(
    Array.from(
      { length: sheet.columnCount },
      (_, i) => sheet.getRow(2).getCell(i + 1).value,
    ),
    [
      "doctor",
      "מטופל",
      0.167,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      0.167,
      2,
      1,
      1,
      0.5,
      0.5,
      0.25,
      "17/11/26",
      "18/11/26",
    ],
  );
  const patient = fixture();
  patient.exercises.forEach((exercise) => {
    exercise.recommendedVAS = 0;
  });
  const noTarget = createPatientExportWorkbook(
    "doctor",
    [patient],
    "UTC",
  ).getWorksheet("Patients Statistics")!;
  assert.equal(noTarget.getCell("O2").value, null);
  patient.repetitions = [];
  const noScores = createPatientExportWorkbook(
    "doctor",
    [patient],
    "UTC",
  ).getWorksheet("Patients Statistics")!;
  assert.equal(noScores.getCell("L2").value, null);
});

void test("compares exercise properties across plans and records removals", () => {
  const patient = fixture();
  const original = patient.exercises[0]!;
  patient.exercises.push({ ...original, id: 3, exerciseCode: "VORx2" });
  patient.exercises[1]!.recommendedVAS = original.recommendedVAS;
  const sheet = createPatientExportWorkbook("doctor", [patient], "UTC")
    .worksheets[0]!;
  assert.deepEqual(
    Array.from(
      { length: sheet.rowCount },
      (_, i) => sheet.getRow(i + 1).getCell(5).value,
    ),
    ["FlagProgramChange", 1, 1, 0, 1],
  );
  assert.deepEqual(
    Array.from(
      { length: sheet.columnCount },
      (_, i) => sheet.getRow(5).getCell(i + 1).value,
    ),
    ["doctor", "מטופל", 2, "261118080000", 1, 0, 2, 0, 0, 0, 0, 0, 0, 0],
  );
});

void test("handles no patients, invalid or duplicate sheet names, and formula-like usernames", async () => {
  const empty = createPatientExportWorkbook("doctor", [], "UTC");
  assert.equal(empty.worksheets.length, 4);
  assert.equal(empty.getWorksheet("Patients Statistics")!.rowCount, 1);
  const usernames = [
    "Patients Statistics",
    "patients statistics",
    "a".repeat(40) + "1",
    "a".repeat(40) + "2",
    "a/b:c[d]?*",
    "'",
    "History",
    "=1+1",
  ];
  const patients = usernames.map((username) => ({ ...fixture(), username }));
  const workbook = createPatientExportWorkbook("doctor", patients, "UTC");
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  const names = reopened.worksheets.map((sheet) => sheet.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
  assert.ok(
    names.every((name) => name.length <= 31 && !/[\\/*?:\[\]]/.test(name)),
  );
  const formulaLike = reopened.worksheets.at(-1)!;
  assert.equal(formulaLike.getCell("A2").value, "=1+1");
  assert.equal(formulaLike.getCell("A2").type, ExcelJS.ValueType.String);
});
