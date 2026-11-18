import type { VercelRequest, VercelResponse } from "@vercel/node";
import patientsHandler from "../server/routes/clinician/patients.js";
import treatmentPlanHandler from "../server/routes/clinician/treatment-plan.js";
import patientExportHandler from "../server/routes/clinician/patient-export.js";

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;

const handlers: Record<string, ApiHandler> = {
  patients: patientsHandler,
  "treatment-plan": treatmentPlanHandler,
  "patient-export": patientExportHandler,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actionValue = req.query.action;
  const action = Array.isArray(actionValue) ? actionValue[0] : actionValue;
  const actionHandler = action ? handlers[action] : undefined;

  if (!actionHandler) {
    res.status(404).json({ error: "Clinician route not found" });
    return;
  }

  await actionHandler(req, res);
}
