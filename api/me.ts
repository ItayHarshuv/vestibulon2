import { eq } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearSessionCookie,
  getAccessibleUserProfile,
  getAuthenticatedUser,
  getWorkOS,
  handleOptions,
  setApiHeaders,
} from "./auth.js";
import { db } from "./db/index.js";
import { programs, users } from "./db/schema.js";
import { recordUserSessionHistorySnapshot } from "./prescription-history-service.js";
import {
  getZodErrorMessage,
  profileQuerySchema,
  updateProfileSchema,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,PATCH,DELETE,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "GET,PATCH,DELETE,OPTIONS");

  if (req.method !== "GET" && req.method !== "PATCH" && req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "GET") {
      const queryResult = profileQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: getZodErrorMessage(queryResult.error) });
        return;
      }

      const targetUserId = queryResult.data.userId ?? user.id;
      const profile = await getAccessibleUserProfile(user, targetUserId);
      if (!profile) {
        res.status(targetUserId === user.id ? 404 : 403).json({
          error:
            targetUserId === user.id ? "User profile not found" : "Forbidden",
        });
        return;
      }

      res.status(200).json({
        user: {
          id: profile.workosUserId,
          username: profile.username,
          email: profile.email,
          role: profile.role === "clinician" ? "clinician" : "patient",
          clinicianUserId: profile.clinicianUserId,
          gender:
            profile.gender === "male" || profile.gender === "female"
              ? profile.gender
              : null,
          points: profile.points,
          numberOfSessions: profile.numberOfSessions,
        },
      });
      return;
    }

    if (req.method === "DELETE") {
      const queryResult = profileQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: getZodErrorMessage(queryResult.error) });
        return;
      }

      const targetUserId = queryResult.data.userId ?? user.id;
      const profile = await getAccessibleUserProfile(user, targetUserId);
      if (!profile) {
        res.status(targetUserId === user.id ? 404 : 403).json({
          error:
            targetUserId === user.id ? "User profile not found" : "Forbidden",
        });
        return;
      }

      const deletingSelf = targetUserId === user.id;
      let deletedFromWorkOS = false;

      try {
        if (deletingSelf && user.sessionId) {
          await getWorkOS().userManagement.revokeSession({ sessionId: user.sessionId }).catch(
            (error) => {
              console.error("Error revoking WorkOS session before deletion:", error);
            },
          );
        }

        await getWorkOS().userManagement.deleteUser(targetUserId);
        deletedFromWorkOS = true;

        await db.transaction(async (tx) => {
          await tx.delete(programs).where(eq(programs.userId, targetUserId));
          await tx.delete(users).where(eq(users.workosUserId, targetUserId));
        });
      } catch (error) {
        console.error("Error deleting user:", error);

        if (deletedFromWorkOS) {
          if (deletingSelf) {
            clearSessionCookie(req, res);
          }

          res.status(502).json({
            error: "User deleted from WorkOS but local cleanup failed",
          });
          return;
        }

        res.status(500).json({ error: "Failed to delete user" });
        return;
      }

      if (deletingSelf) {
        clearSessionCookie(req, res);
      }

      res.status(200).json({ ok: true });
      return;
    }

    const bodyResult = updateProfileSchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
      return;
    }

    const targetUserId = bodyResult.data.userId ?? user.id;
    const profile = await getAccessibleUserProfile(user, targetUserId);
    if (!profile) {
      res.status(targetUserId === user.id ? 404 : 403).json({
        error:
          targetUserId === user.id ? "User profile not found" : "Forbidden",
      });
      return;
    }

    const updates: {
      gender?: "male" | "female";
      numberOfSessions?: number;
    } = {};

    if (bodyResult.data.gender !== undefined) {
      if (targetUserId !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      updates.gender = bodyResult.data.gender;
    }

    if (bodyResult.data.numberOfSessions !== undefined) {
      const canClinicianUpdatePatientSessions =
        user.role === "clinician" &&
        profile.role === "patient" &&
        profile.clinicianUserId === user.id;
      if (!canClinicianUpdatePatientSessions) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      updates.numberOfSessions = bodyResult.data.numberOfSessions;
    }

    const updated = await db
      .update(users)
      .set(updates)
      .where(eq(users.workosUserId, targetUserId))
      .returning();

    const updatedProfile = updated[0];
    if (!updatedProfile) {
      res.status(404).json({ error: "User profile not found" });
      return;
    }

    if (updates.numberOfSessions !== undefined) {
      await recordUserSessionHistorySnapshot(
        targetUserId,
        updatedProfile.numberOfSessions,
      );
    }

    res.status(200).json({
      user: {
        id: updatedProfile.workosUserId,
        username: updatedProfile.username,
        email: updatedProfile.email,
        role: updatedProfile.role === "clinician" ? "clinician" : "patient",
        clinicianUserId: updatedProfile.clinicianUserId,
        gender:
          updatedProfile.gender === "male" || updatedProfile.gender === "female"
            ? updatedProfile.gender
            : null,
        points: updatedProfile.points,
        numberOfSessions: updatedProfile.numberOfSessions,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
}
