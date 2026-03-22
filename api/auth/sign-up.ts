import { eq, or } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../db/index.js";
import { userProfiles } from "../db/schema.js";
import {
  getAuthenticationOptions,
  getWorkOS,
  handleOptions,
  setApiHeaders,
  setSessionCookie,
} from "../auth.js";
import {
  getZodErrorMessage,
  signUpRequestSchema,
} from "../../src/lib/validation.js";

function getWorkOSErrorMessage(error: unknown, fallback: string) {
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

  return fallback;
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

  const bodyResult = signUpRequestSchema.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
    return;
  }

  const { email, password, username } = bodyResult.data;

  try {
    const existingProfiles = await db
      .select({
        username: userProfiles.username,
        email: userProfiles.email,
      })
      .from(userProfiles)
      .where(or(eq(userProfiles.username, username), eq(userProfiles.email, email)))
      .limit(2);

    if (existingProfiles.some((profile) => profile.username === username)) {
      res.status(409).json({ error: "שם המשתמש כבר תפוס" });
      return;
    }

    if (existingProfiles.some((profile) => profile.email === email)) {
      res.status(409).json({ error: "כתובת האימייל כבר קיימת במערכת" });
      return;
    }

    const workos = getWorkOS();
    const createdUser = await workos.userManagement.createUser({
      email,
      password,
    });

    try {
      await db.insert(userProfiles).values({
        workosUserId: createdUser.id,
        username,
        email: createdUser.email,
      });
    } catch (error) {
      await workos.userManagement.deleteUser(createdUser.id).catch((deleteError) => {
        console.error("Error rolling back WorkOS user creation:", deleteError);
      });
      throw error;
    }

    const authentication = await workos.userManagement.authenticateWithPassword({
      email: createdUser.email,
      password,
      ...getAuthenticationOptions(req),
    });

    if (!authentication.sealedSession) {
      throw new Error("Missing sealed session");
    }

    setSessionCookie(req, res, authentication.sealedSession);
    res.status(201).json({
      user: {
        id: createdUser.id,
        username,
        email: createdUser.email,
        gender: null,
      },
    });
  } catch (error) {
    console.error("Error signing up user:", error);
    res.status(400).json({
      error: getWorkOSErrorMessage(error, "ההרשמה נכשלה"),
    });
  }
}
