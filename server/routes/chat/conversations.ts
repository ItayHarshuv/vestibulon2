import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "../../auth.js";
import { listChatContacts } from "../../chat-service.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,OPTIONS")) return;
  setApiHeaders(req, res, "GET,OPTIONS");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const contacts = await listChatContacts(user);
    res.status(200).json({ contacts });
  } catch (error) {
    console.error("Error listing chat contacts:", error);
    res.status(500).json({ error: "Failed to list chat contacts" });
  }
}
