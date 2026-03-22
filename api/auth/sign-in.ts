import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAuthenticationOptions,
  getUserProfileByUsername,
  getWorkOS,
  handleOptions,
  setApiHeaders,
  setSessionCookie,
} from "../auth.js";
import {
  getZodErrorMessage,
  signInRequestSchema,
} from "../../src/lib/validation.js";

function getWorkOSErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "error_description" in error &&
    typeof error.error_description === "string"
  ) {
    return error.error_description;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "שם המשתמש או הסיסמה שגויים";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "POST,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "POST,OPTIONS");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const bodyResult = signInRequestSchema.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
    return;
  }

  const { password, username } = bodyResult.data;

  try {
    const profile = await getUserProfileByUsername(username);
    if (!profile) {
      res.status(401).json({ error: "שם המשתמש או הסיסמה שגויים" });
      return;
    }

    const authentication = await getWorkOS().userManagement.authenticateWithPassword({
      email: profile.email,
      password,
      ...getAuthenticationOptions(req),
    });

    if (!authentication.sealedSession) {
      throw new Error("Missing sealed session");
    }

    setSessionCookie(req, res, authentication.sealedSession);
    res.status(200).json({
      user: {
        id: profile.workosUserId,
        username: profile.username,
        email: profile.email,
        gender:
          profile.gender === "male" || profile.gender === "female"
            ? profile.gender
            : null,
      },
    });
  } catch (error) {
    console.error("Error signing in user:", error);
    res.status(401).json({ error: getWorkOSErrorMessage(error) });
  }
}
