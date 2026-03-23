import { and, eq } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, handleOptions, setApiHeaders } from "./auth.js";
import { db } from "./db/index.js";
import { programs, reps } from "./db/schema.js";
import {
  createRepBodySchema,
  getZodErrorMessage,
  updateRepBodySchema,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "POST,PATCH,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "POST,PATCH,OPTIONS");

  try {
    const authenticatedUser = await getAuthenticatedUser(req, res);
    const authenticatedUserId = authenticatedUser?.id;

    if (!authenticatedUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "POST") {
      const bodyResult = createRepBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      const { programId } = bodyResult.data;
      const matchingPrograms = await db
        .select({
          id: programs.id,
          exerciseName: programs.exerciseName,
        })
        .from(programs)
        .where(
          and(
            eq(programs.id, programId),
            eq(programs.userId, authenticatedUserId),
          ),
        )
        .limit(1);

      const program = matchingPrograms[0];
      if (!program) {
        res.status(404).json({ error: "Program not found" });
        return;
      }

      const now = new Date();

      const inserted = await db
        .insert(reps)
        .values({
          programId: program.id,
          userId: authenticatedUserId,
          exerciseName: program.exerciseName,
          startTime: now,
        })
        .returning({
          id: reps.id,
          startTime: reps.startTime,
        });

      const createdRep = inserted[0];
      if (!createdRep) {
        res.status(500).json({ error: "Failed to create rep" });
        return;
      }

      res.status(201).json(createdRep);
      return;
    }

    if (req.method === "PATCH") {
      const bodyResult = updateRepBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      const {
        bpmEndOfRep,
        dizziness,
        flagPaused,
        generalDifficulty,
        nausea,
        numberOfSeconds,
        repId,
      } = bodyResult.data;

      const valuesToUpdate: {
        endTime?: Date;
        bpmEndOfRep?: number;
        flagPaused?: boolean;
        dizziness?: number;
        nausea?: number;
        generalDifficulty?: number;
      } = {};

      if (numberOfSeconds !== undefined) {
        const repRows = await db
          .select({
            startTime: reps.startTime,
          })
          .from(reps)
          .where(and(eq(reps.id, repId), eq(reps.userId, authenticatedUserId)))
          .limit(1);

        const repRow = repRows[0];
        if (!repRow?.startTime) {
          res.status(404).json({ error: "Rep not found" });
          return;
        }

        valuesToUpdate.endTime = new Date(
          repRow.startTime.getTime() + numberOfSeconds * 1000,
        );
      }

      if (bpmEndOfRep !== undefined) {
        valuesToUpdate.bpmEndOfRep = bpmEndOfRep;
      }

      if (flagPaused !== undefined) {
        valuesToUpdate.flagPaused = flagPaused;
      }

      if (dizziness !== undefined) {
        valuesToUpdate.dizziness = dizziness;
      }

      if (nausea !== undefined) {
        valuesToUpdate.nausea = nausea;
      }

      if (generalDifficulty !== undefined) {
        valuesToUpdate.generalDifficulty = generalDifficulty;
      }

      const updated = await db
        .update(reps)
        .set(valuesToUpdate)
        .where(and(eq(reps.id, repId), eq(reps.userId, authenticatedUserId)))
        .returning({ id: reps.id });

      if (updated.length === 0) {
        res.status(404).json({ error: "Rep not found" });
        return;
      }

      res.status(200).json({
        id: repId,
        ...valuesToUpdate,
      });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling reps endpoint:", error);
    res.status(500).json({ error: "Failed to handle reps endpoint" });
  }
}
