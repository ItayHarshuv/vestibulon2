import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, handleOptions, setApiHeaders } from "./auth.js";
import {
  getSessionTimesForUser,
  updateSessionTimesForUser,
} from "./session-times-service.js";
import {
  getZodErrorMessage,
  sessionTimesQuerySchema,
  updateSessionTimesBodySchema,
} from "../src/lib/validation.js";

function toResponse(rows: Awaited<ReturnType<typeof getSessionTimesForUser>>) {
  return rows.map((row) => ({
    sessionIndex: row.sessionIndex,
    localTime: row.localTime.slice(0, 5),
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,PATCH,OPTIONS")) return;
  setApiHeaders(req, res, "GET,PATCH,OPTIONS");

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "GET") {
      const parsed = sessionTimesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: getZodErrorMessage(parsed.error) });
        return;
      }
      res
        .status(200)
        .json(
          toResponse(
            await getSessionTimesForUser(user.id, parsed.data.timeZone),
          ),
        );
      return;
    }

    if (req.method === "PATCH") {
      const parsed = updateSessionTimesBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: getZodErrorMessage(parsed.error) });
        return;
      }
      res
        .status(200)
        .json(
          toResponse(
            await updateSessionTimesForUser(
              user.id,
              parsed.data.timeZone,
              parsed.data.sessionTimes,
            ),
          ),
        );
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling session times:", error);
    res.status(500).json({ error: "Failed to handle session times" });
  }
}
