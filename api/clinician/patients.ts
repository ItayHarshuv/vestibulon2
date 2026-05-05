import { and, eq, or } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../db/index.js";
import { userProfiles } from "../db/schema.js";
import {
  getAuthenticatedUser,
  getWorkOS,
  handleOptions,
  setApiHeaders,
} from "../auth.js";
import {
  getZodErrorMessage,
  signUpRequestSchema,
} from "../../src/lib/validation.js";

function getWorkOSErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    if (typeof errorRecord.code === "string") {
      return errorRecord.code;
    }
  }

  return null;
}

function getFirstNestedWorkOSError(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const nestedErrors = (error as { errors?: unknown }).errors;
  if (!Array.isArray(nestedErrors)) {
    return null;
  }

  const firstError: unknown = nestedErrors[0];
  if (!firstError || typeof firstError !== "object") {
    return null;
  }

  return firstError as Record<string, unknown>;
}

function getWorkOSNestedErrorCode(error: unknown) {
  const firstError = getFirstNestedWorkOSError(error);
  if (typeof firstError?.code === "string") {
    return firstError.code;
  }

  return null;
}

function getWorkOSErrorMessage(error: unknown, fallback: string) {
  const nestedErrorCode = getWorkOSNestedErrorCode(error);
  if (nestedErrorCode === "email_not_available") {
    return "כתובת האימייל כבר קיימת במערכת";
  }

  const firstError = getFirstNestedWorkOSError(error);
  if (typeof firstError?.message === "string") {
    return firstError.message;
  }

  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    if (typeof errorRecord.error_description === "string") {
      return errorRecord.error_description;
    }

    if (typeof errorRecord.message === "string") {
      return errorRecord.message;
    }
  }

  return fallback;
}

type WorkOSUser = NonNullable<Awaited<ReturnType<typeof findWorkOSUserByEmail>>>;

async function findWorkOSUserByEmail(email: string) {
  const users = await getWorkOS().userManagement.listUsers({ email });
  return users.data.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

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
      const patients = await db
        .select({
          id: userProfiles.workosUserId,
          username: userProfiles.username,
          email: userProfiles.email,
        })
        .from(userProfiles)
        .where(
          and(
            eq(userProfiles.role, "patient"),
            eq(userProfiles.clinicianUserId, clinician.id),
          ),
        )
        .orderBy(userProfiles.username);

      res.status(200).json({ patients });
      return;
    }

    const bodyResult = signUpRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
      return;
    }

    const { email, password, username } = bodyResult.data;

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
    let createdUser: WorkOSUser | null = null;
    let didCreateWorkOSUser = false;

    try {
      createdUser = await workos.userManagement.createUser({
        email,
        password,
      });
      didCreateWorkOSUser = true;
    } catch (error) {
      const isRecoverableExistingEmail =
        getWorkOSErrorCode(error) === "user_creation_error" &&
        getWorkOSNestedErrorCode(error) === "email_not_available";

      if (!isRecoverableExistingEmail) {
        throw error;
      }

      const existingWorkOSUser = await findWorkOSUserByEmail(email);
      if (!existingWorkOSUser) {
        throw error;
      }

      createdUser = existingWorkOSUser;
    }

    if (!createdUser) {
      throw new Error("Missing WorkOS user");
    }

    try {
      await db.insert(userProfiles).values({
        workosUserId: createdUser.id,
        username,
        email: createdUser.email,
        role: "patient",
        clinicianUserId: clinician.id,
      });
    } catch (error) {
      if (didCreateWorkOSUser) {
        await workos.userManagement.deleteUser(createdUser.id).catch((deleteError) => {
          console.error("Error rolling back WorkOS user creation:", deleteError);
        });
      }
      throw error;
    }

    res.status(201).json({
      user: {
        id: createdUser.id,
        username,
        email: createdUser.email,
        role: "patient",
        clinicianUserId: clinician.id,
        gender: null,
        points: 0,
      },
    });
  } catch (error) {
    console.error("Error creating clinician patient:", error);
    res.status(400).json({
      error: getWorkOSErrorMessage(error, "יצירת המטופל/ת נכשלה"),
    });
  }
}
