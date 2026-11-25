import { and, asc, desc, eq, lt } from "drizzle-orm";
import type { AuthenticatedUser } from "./auth.js";
import { db } from "./db/index.js";
import {
  conversationParticipants,
  conversations,
  messages,
  users,
} from "./db/schema.js";

export class ChatAccessError extends Error {}

async function getChatPair(user: AuthenticatedUser, otherUserId: string) {
  const rows = await db
    .select({
      id: users.workosUserId,
      username: users.username,
      role: users.role,
      clinicianUserId: users.clinicianUserId,
    })
    .from(users)
    .where(eq(users.workosUserId, otherUserId))
    .limit(1);
  const otherUser = rows[0];

  if (
    !otherUser ||
    otherUserId === user.id ||
    (user.role === "clinician" &&
      (otherUser.role !== "patient" ||
        otherUser.clinicianUserId !== user.id)) ||
    (user.role === "patient" &&
      (otherUser.role !== "clinician" || user.clinicianUserId !== otherUserId))
  ) {
    throw new ChatAccessError("Forbidden");
  }

  return user.role === "clinician"
    ? {
        patientUserId: otherUserId,
        clinicianUserId: user.id,
        otherUsername: otherUser.username,
      }
    : {
        patientUserId: user.id,
        clinicianUserId: otherUserId,
        otherUsername: otherUser.username,
      };
}

export async function listChatContacts(user: AuthenticatedUser) {
  const contactRows =
    user.role === "clinician"
      ? await db
          .select({
            userId: users.workosUserId,
            username: users.username,
          })
          .from(users)
          .where(
            and(eq(users.role, "patient"), eq(users.clinicianUserId, user.id)),
          )
          .orderBy(asc(users.username))
      : user.clinicianUserId
        ? await db
            .select({
              userId: users.workosUserId,
              username: users.username,
            })
            .from(users)
            .where(
              and(
                eq(users.workosUserId, user.clinicianUserId),
                eq(users.role, "clinician"),
              ),
            )
            .limit(1)
        : [];

  if (contactRows.length === 0) {
    return [];
  }

  const conversationRows = await db
    .select({
      id: conversations.id,
      patientUserId: conversations.patientUserId,
      clinicianUserId: conversations.clinicianUserId,
    })
    .from(conversations)
    .where(
      user.role === "clinician"
        ? eq(conversations.clinicianUserId, user.id)
        : eq(conversations.patientUserId, user.id),
    );
  const conversationByOtherUserId = new Map(
    conversationRows.map((conversation) => [
      user.role === "clinician"
        ? conversation.patientUserId
        : conversation.clinicianUserId,
      conversation.id,
    ]),
  );

  return contactRows.map((contact) => ({
    ...contact,
    conversationId: conversationByOtherUserId.get(contact.userId) ?? null,
  }));
}

async function findConversation(
  patientUserId: string,
  clinicianUserId: string,
) {
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.patientUserId, patientUserId),
        eq(conversations.clinicianUserId, clinicianUserId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function ensureConversation(
  patientUserId: string,
  clinicianUserId: string,
) {
  const insertedRows = await db
    .insert(conversations)
    .values({ patientUserId, clinicianUserId })
    .onConflictDoNothing()
    .returning();
  const conversation = insertedRows[0]
    ? { id: insertedRows[0].id }
    : await findConversation(patientUserId, clinicianUserId);
  if (!conversation) {
    throw new Error("Failed to create conversation");
  }

  await db
    .insert(conversationParticipants)
    .values([
      { conversationId: conversation.id, userId: patientUserId },
      { conversationId: conversation.id, userId: clinicianUserId },
    ])
    .onConflictDoNothing();

  return conversation;
}

export async function getChatMessages(
  user: AuthenticatedUser,
  otherUserId: string,
  before?: number,
) {
  const pair = await getChatPair(user, otherUserId);
  const conversation = await findConversation(
    pair.patientUserId,
    pair.clinicianUserId,
  );
  if (!conversation) {
    return { conversationId: null, messages: [], hasMore: false };
  }

  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderUserId: messages.senderUserId,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      before
        ? and(
            eq(messages.conversationId, conversation.id),
            lt(messages.id, before),
          )
        : eq(messages.conversationId, conversation.id),
    )
    .orderBy(desc(messages.id))
    .limit(51);
  const hasMore = rows.length > 50;

  return {
    conversationId: conversation.id,
    messages: rows
      .slice(0, 50)
      .reverse()
      .map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      })),
    hasMore,
  };
}

export async function sendChatMessage(
  user: AuthenticatedUser,
  otherUserId: string,
  body: string,
  clientMessageId: string,
) {
  const pair = await getChatPair(user, otherUserId);
  const conversation = await ensureConversation(
    pair.patientUserId,
    pair.clinicianUserId,
  );
  const insertedRows = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      senderUserId: user.id,
      body,
      clientMessageId,
    })
    .onConflictDoNothing()
    .returning();
  const inserted = insertedRows[0]
    ? {
        id: insertedRows[0].id,
        conversationId: insertedRows[0].conversationId,
        senderUserId: insertedRows[0].senderUserId,
        body: insertedRows[0].body,
        createdAt: insertedRows[0].createdAt,
      }
    : null;
  const existing =
    inserted ??
    (
      await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderUserId: messages.senderUserId,
          body: messages.body,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(
          and(
            eq(messages.senderUserId, user.id),
            eq(messages.clientMessageId, clientMessageId),
            eq(messages.conversationId, conversation.id),
          ),
        )
        .limit(1)
    )[0];

  if (!existing) {
    throw new Error("clientMessageId was already used");
  }

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversation.id));

  return {
    message: {
      ...existing,
      createdAt: existing.createdAt.toISOString(),
    },
    recipientUserId: otherUserId,
    isNew: inserted !== null,
  };
}

export async function markChatRead(
  user: AuthenticatedUser,
  otherUserId: string,
) {
  const pair = await getChatPair(user, otherUserId);
  const conversation = await findConversation(
    pair.patientUserId,
    pair.clinicianUserId,
  );
  if (!conversation) {
    return;
  }

  await db
    .insert(conversationParticipants)
    .values({
      conversationId: conversation.id,
      userId: user.id,
      lastReadAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        conversationParticipants.conversationId,
        conversationParticipants.userId,
      ],
      set: { lastReadAt: new Date() },
    });
}
