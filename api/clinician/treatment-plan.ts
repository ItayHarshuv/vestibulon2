import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAccessibleUserProfile,
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "../auth.js";
import {
  getTreatmentPlanForUser,
  saveTreatmentPlanForUser,
} from "../treatment-plan-service.js";
import {
  getZodErrorMessage,
  saveTreatmentPlanBodySchema,
  treatmentPlanQuerySchema,
} from "../../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,POST,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "GET,POST,OPTIONS");

  if (req.method !== "GET" && req.method !== "POST") {
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

    if (req.method === "GET") {
      const queryResult = treatmentPlanQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: getZodErrorMessage(queryResult.error) });
        return;
      }

      const { userId } = queryResult.data;
      const profile = await getAccessibleUserProfile(clinician, userId);
      if (!profile) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      if (profile.role !== "patient" && profile.workosUserId !== clinician.id) {
        res.status(400).json({ error: "Treatment plans are only available for patients" });
        return;
      }

      const plan = await getTreatmentPlanForUser(userId);
      if (!plan) {
        res.status(404).json({ error: "User profile not found" });
        return;
      }

      res.status(200).json(plan);
      return;
    }

    const bodyResult = saveTreatmentPlanBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
      return;
    }

    const profile = await getAccessibleUserProfile(clinician, bodyResult.data.userId);
    if (!profile) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (profile.role !== "patient" && profile.workosUserId !== clinician.id) {
      res.status(400).json({ error: "Treatment plans are only available for patients" });
      return;
    }

    const saved = await saveTreatmentPlanForUser(clinician.id, bodyResult.data);
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error handling treatment plan:", error);
    res.status(500).json({ error: "Failed to process treatment plan" });
  }
}
