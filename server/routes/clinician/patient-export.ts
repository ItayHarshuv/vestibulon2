import { and, asc, eq, inArray } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "../../auth.js";
import { db } from "../../db/index.js";
import {
  performedReps,
  treatmentPlanExercises,
  treatmentPlans,
  users,
} from "../../db/schema.js";
import { getExerciseStatisticsForUser } from "../../exercise-statistics-service.js";
import { createPatientExportWorkbook } from "../../patient-export-workbook.js";
import { getPatientFollowUp } from "../../patient-follow-up-service.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,OPTIONS")) return;
  setApiHeaders(req, res, "GET,OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const clinician = await getAuthenticatedUser(req, res);
    if (!clinician) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (clinician.role !== "clinician") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const timeZone =
      typeof req.query.timeZone === "string" ? req.query.timeZone : "UTC";
    try {
      new Intl.DateTimeFormat("en", { timeZone }).format();
    } catch {
      res.status(400).json({ error: "Invalid time zone" });
      return;
    }
    // Never accept a client-supplied patient list: scope every export to the
    // authenticated clinician's currently assigned patients.
    const patients = await db
      .select()
      .from(users)
      .where(
        and(eq(users.role, "patient"), eq(users.clinicianUserId, clinician.id)),
      )
      .orderBy(asc(users.username));
    const data = [];
    for (const patient of patients) {
      const plans = await db
        .select()
        .from(treatmentPlans)
        .where(eq(treatmentPlans.patientUserId, patient.workosUserId))
        .orderBy(asc(treatmentPlans.createdAt), asc(treatmentPlans.id));
      const planIds = plans.map((plan) => plan.id);
      const [exercises, repetitions, statistics, followUp] = await Promise.all([
        planIds.length
          ? db
              .select()
              .from(treatmentPlanExercises)
              .where(inArray(treatmentPlanExercises.treatmentPlanId, planIds))
              .orderBy(asc(treatmentPlanExercises.id))
          : Promise.resolve([]),
        db
          .select()
          .from(performedReps)
          .where(eq(performedReps.patientUserId, patient.workosUserId))
          .orderBy(asc(performedReps.startTime), asc(performedReps.id)),
        getExerciseStatisticsForUser(patient.workosUserId, timeZone),
        getPatientFollowUp(patient.workosUserId),
      ]);
      data.push({
        username: patient.username,
        plans,
        exercises,
        repetitions,
        statistics,
        followUp,
      });
    }
    const workbook = createPatientExportWorkbook(
      clinician.username,
      data,
      timeZone,
    );
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="PatientPracticeData.xlsx"',
    );
    res.status(200);
    res.end(Buffer.from(buffer));
  } catch (error) {
    console.error("Error exporting patient data:", error);
    res.status(500).json({ error: "Failed to export patient data" });
  }
}
