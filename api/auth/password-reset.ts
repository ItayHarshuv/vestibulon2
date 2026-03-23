import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getUserProfileByIdentifier,
  getWorkOS,
  handleOptions,
  setApiHeaders,
} from "../auth.js";
import {
  getZodErrorMessage,
  passwordResetRequestSchema,
} from "../../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "POST,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "POST,OPTIONS");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const bodyResult = passwordResetRequestSchema.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
    return;
  }

  try {
    const profile = await getUserProfileByIdentifier(bodyResult.data.identifier);
    if (profile) {
      await getWorkOS().userManagement.createPasswordReset({
        email: profile.email,
      });
    }
  } catch (error) {
    console.error("Error creating password reset:", error);
  }

  res.status(200).json({
    ok: true,
    message: "אם קיים חשבון תואם, נשלח אימייל לאיפוס הסיסמה.",
  });
}
