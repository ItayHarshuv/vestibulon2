import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "../auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "GET,OPTIONS");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await getAuthenticatedUser(req, res);
    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching auth session:", error);
    res.status(500).json({ error: "Failed to fetch session" });
  }
}
