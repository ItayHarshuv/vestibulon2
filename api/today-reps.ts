import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, handleOptions, setApiHeaders } from "./auth.js";
import {
  ensureTodayRepsForUser,
} from "./today-reps-service.js";
import {
  getZodErrorMessage,
  syncTodayRepsBodySchema,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "POST,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "POST,OPTIONS");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authenticatedUser = await getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const bodyResult = syncTodayRepsBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
      return;
    }

    const synced = await ensureTodayRepsForUser(
      authenticatedUser.id,
      bodyResult.data.timeZone,
    );

    res.status(200).json(synced);
  } catch (error) {
    console.error("Error syncing today's reps:", error);
    res.status(500).json({ error: "Failed to sync today's reps" });
  }
}
