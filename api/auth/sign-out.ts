import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearSessionCookie,
  getAuthenticatedUser,
  getWorkOS,
  handleOptions,
  setApiHeaders,
} from "../auth.js";

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
    const user = await getAuthenticatedUser(req, res);
    if (user?.sessionId) {
      await getWorkOS().userManagement.revokeSession({ sessionId: user.sessionId });
    }
  } catch (error) {
    console.error("Error revoking WorkOS session:", error);
  } finally {
    clearSessionCookie(req, res);
  }

  res.status(200).json({ ok: true });
}
