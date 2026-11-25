// Shared Drizzle schema (used by Vercel functions + local dev)
// Keep this as the single source of truth.

import { relations, sql } from "drizzle-orm";
import { check, index, pgTableCreator, uniqueIndex } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `vestibulon2_${name}`);

export const users = createTable(
  "users",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    workosUserId: d.varchar("workos_user_id", { length: 256 }).notNull().unique(),
    username: d.varchar("username", { length: 256 }).notNull().unique(),
    email: d.varchar("email", { length: 256 }).notNull().unique(),
    role: d.varchar("role", { length: 32 }).notNull().default("patient"),
    clinicianUserId: d
      .varchar("clinician_user_id", { length: 256 })
      .references((): AnyPgColumn => users.workosUserId, {
        onDelete: "set null",
      }),
    gender: d.varchar("gender", { length: 16 }),
    points: d.integer("points").notNull().default(0),
    timeZone: d.varchar("time_zone", { length: 128 }).notNull().default("UTC"),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d
      .timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("users_workos_user_idx").on(t.workosUserId),
    index("users_username_idx").on(t.username),
    index("users_email_idx").on(t.email),
    index("users_role_idx").on(t.role),
    index("users_clinician_user_idx").on(t.clinicianUserId),
  ],
);

export const treatmentPlans = createTable(
  "treatment_plans",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    patientUserId: d
      .varchar("patient_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    clinicianUserId: d
      .varchar("clinician_user_id", { length: 256 })
      .references(() => users.workosUserId, { onDelete: "set null" }),
    sessionsPerDay: d.integer("sessions_per_day").notNull(),
    effectiveDate: d.date("effective_date", { mode: "string" }).notNull(),
    effectiveSessionIndex: d.integer("effective_session_index").notNull().default(1),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("treatment_plans_patient_created_idx").on(t.patientUserId, t.createdAt, t.id),
    index("treatment_plans_patient_effective_idx").on(
      t.patientUserId,
      t.effectiveDate,
      t.effectiveSessionIndex,
    ),
    check("treatment_plans_sessions_check", sql`${t.sessionsPerDay} between 1 and 10`),
    check(
      "treatment_plans_effective_session_check",
      sql`${t.effectiveSessionIndex} between 1 and 10`,
    ),
  ],
);

export const treatmentPlanExercises = createTable(
  "treatment_plan_exercises",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    treatmentPlanId: d
      .integer("treatment_plan_id")
      .notNull()
      .references(() => treatmentPlans.id, { onDelete: "cascade" }),
    exerciseCode: d.varchar("exercise_code", { length: 256 }).notNull(),
    secondsPerRep: d.integer("seconds_per_rep").notNull(),
    repsPerSession: d.integer("reps_per_session").notNull(),
    targetBpm: d.integer("target_bpm").notNull(),
    position: d.varchar("position", { length: 256 }).notNull(),
    background: d.varchar("background", { length: 256 }).notNull(),
    recommendedVAS: d.integer("recommended_vas").notNull(),
  }),
  (t) => [
    index("treatment_plan_exercises_plan_idx").on(t.treatmentPlanId),
    uniqueIndex("treatment_plan_exercises_plan_code_uidx").on(
      t.treatmentPlanId,
      t.exerciseCode,
    ),
  ],
);

export const sessionTimes = createTable(
  "session_times",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .varchar("user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, {
        onDelete: "cascade",
      }),
    sessionIndex: d.integer("session_index").notNull(),
    localTime: d.time("local_time").notNull(),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d
      .timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    uniqueIndex("session_times_user_index_uidx").on(t.userId, t.sessionIndex),
    uniqueIndex("session_times_user_time_uidx").on(t.userId, t.localTime),
    index("session_times_user_idx").on(t.userId),
    check("session_times_index_check", sql`${t.sessionIndex} between 1 and 10`),
  ],
);

export const pushSubscriptions = createTable(
  "push_subscriptions",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .varchar("user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    endpoint: d.text("endpoint").notNull(),
    p256dh: d.text("p256dh").notNull(),
    auth: d.text("auth").notNull(),
    lastNotificationKey: d.varchar("last_notification_key", { length: 64 }),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d
      .timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_uidx").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);

export const conversations = createTable(
  "conversations",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    patientUserId: d
      .varchar("patient_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    clinicianUserId: d
      .varchar("clinician_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d
      .timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    uniqueIndex("conversations_patient_clinician_uidx").on(
      t.patientUserId,
      t.clinicianUserId,
    ),
    index("conversations_patient_idx").on(t.patientUserId),
    index("conversations_clinician_idx").on(t.clinicianUserId),
  ],
);

export const messages = createTable(
  "messages",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    conversationId: d
      .integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: d
      .varchar("sender_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    body: d.varchar("body", { length: 4000 }).notNull(),
    clientMessageId: d.uuid("client_message_id").notNull(),
    patientPushSentAt: d.timestamp("patient_push_sent_at", {
      withTimezone: true,
    }),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt,
      t.id,
    ),
    uniqueIndex("messages_sender_client_uidx").on(
      t.senderUserId,
      t.clientMessageId,
    ),
  ],
);

export const patientPracticeReviews = createTable(
  "patient_practice_reviews",
  (d) => ({
    patientUserId: d
      .varchar("patient_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    clinicianUserId: d
      .varchar("clinician_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    viewId: d.uuid("view_id").notNull(),
    reviewedAt: d
      .timestamp("reviewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (t) => [
    uniqueIndex("patient_practice_reviews_view_uidx").on(
      t.patientUserId,
      t.clinicianUserId,
      t.viewId,
    ),
  ],
);

export const practiceReviewNotifications = createTable(
  "practice_review_notifications",
  (d) => ({
    patientUserId: d
      .varchar("patient_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    clinicianUserId: d
      .varchar("clinician_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    requestId: d.uuid("request_id").notNull(),
    requestedAt: d
      .timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    sentAt: d.timestamp("sent_at", { withTimezone: true }),
  }),
  (t) => [
    uniqueIndex("practice_review_notifications_request_uidx").on(
      t.patientUserId,
      t.clinicianUserId,
      t.requestId,
    ),
  ],
);

export const patientAppUsageIntervals = createTable(
  "patient_app_usage_intervals",
  (d) => ({
    patientUserId: d
      .varchar("patient_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    intervalId: d.uuid("interval_id").notNull(),
    startedAt: d.timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: d.timestamp("ended_at", { withTimezone: true }).notNull(),
  }),
  (t) => [
    uniqueIndex("patient_app_usage_intervals_interval_uidx").on(
      t.patientUserId,
      t.intervalId,
    ),
    index("patient_app_usage_intervals_started_idx").on(
      t.patientUserId,
      t.startedAt,
    ),
    check(
      "patient_app_usage_interval_duration",
      sql`${t.endedAt} > ${t.startedAt} and ${t.endedAt} <= ${t.startedAt} + interval '30 seconds'`,
    ),
  ],
);

export const conversationParticipants = createTable(
  "conversation_participants",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    conversationId: d
      .integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: d
      .varchar("user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    lastReadAt: d.timestamp("last_read_at", { withTimezone: true }),
  }),
  (t) => [
    uniqueIndex("conversation_participants_conversation_user_uidx").on(
      t.conversationId,
      t.userId,
    ),
    index("conversation_participants_user_idx").on(t.userId),
  ],
);

export const performedReps = createTable(
  "performed_reps",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    treatmentPlanExerciseId: d
      .integer("treatment_plan_exercise_id")
      .references(() => treatmentPlanExercises.id, { onDelete: "restrict" }),
    patientUserId: d
      .varchar("patient_user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    scheduledDate: d.date("scheduled_date", { mode: "string" }),
    sessionIndex: d.integer("session_index"),
    repIndex: d.integer("rep_index"),
    scheduledAt: d.timestamp("scheduled_at", { withTimezone: true }),
    clientRequestId: d.uuid("client_request_id"),
    dizziness: d.integer(),
    nausea: d.integer(),
    generalDifficulty: d.integer("general_difficulty"),
    restTime: d.integer("rest_time"),
    startTime: d.timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: d.timestamp("end_time", { withTimezone: true }),
    bpmEndOfRep: d.integer("bpm_end_of_rep"),
    flagInterrupted: d.boolean("flag_interrupted").default(false),
    flagPaused: d.boolean("flag_paused").default(false),
  }),
  (t) => [
    index("performed_reps_treatment_plan_exercise_idx").on(
      t.treatmentPlanExerciseId,
    ),
    index("performed_reps_patient_schedule_idx").on(
      t.patientUserId,
      t.scheduledDate,
      t.sessionIndex,
    ),
    uniqueIndex("performed_reps_slot_uidx")
      .on(
        t.patientUserId,
        t.scheduledDate,
        t.sessionIndex,
        t.treatmentPlanExerciseId,
        t.repIndex,
      )
      .where(sql`${t.scheduledDate} is not null`),
    uniqueIndex("performed_reps_request_uidx")
      .on(t.patientUserId, t.clientRequestId)
      .where(sql`${t.clientRequestId} is not null`),
  ],
);

export const performedRepsRelations = relations(performedReps, ({ one }) => ({
  treatmentPlanExercise: one(treatmentPlanExercises, {
    fields: [performedReps.treatmentPlanExerciseId],
    references: [treatmentPlanExercises.id],
  }),
  patient: one(users, {
    fields: [performedReps.patientUserId],
    references: [users.workosUserId],
  }),
}));

export const treatmentPlansRelations = relations(treatmentPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [treatmentPlans.patientUserId],
    references: [users.workosUserId],
  }),
  createdByUser: one(users, {
    fields: [treatmentPlans.clinicianUserId],
    references: [users.workosUserId],
    relationName: "treatment_plan_creator",
  }),
  exercises: many(treatmentPlanExercises),
}));

export const treatmentPlanExercisesRelations = relations(
  treatmentPlanExercises,
  ({ many, one }) => ({
    treatmentPlan: one(treatmentPlans, {
      fields: [treatmentPlanExercises.treatmentPlanId],
      references: [treatmentPlans.id],
    }),
    performedReps: many(performedReps),
  }),
);

export const sessionTimesRelations = relations(sessionTimes, ({ one }) => ({
  user: one(users, {
    fields: [sessionTimes.userId],
    references: [users.workosUserId],
  }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.workosUserId],
    }),
  }),
);

export const conversationsRelations = relations(
  conversations,
  ({ many, one }) => ({
    patient: one(users, {
      fields: [conversations.patientUserId],
      references: [users.workosUserId],
      relationName: "patient_conversations",
    }),
    clinician: one(users, {
      fields: [conversations.clinicianUserId],
      references: [users.workosUserId],
      relationName: "clinician_conversations",
    }),
    messages: many(messages),
    participants: many(conversationParticipants),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderUserId],
    references: [users.workosUserId],
  }),
}));

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationParticipants.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationParticipants.userId],
      references: [users.workosUserId],
    }),
  }),
);

export const usersRelations = relations(users, ({ many, one }) => ({
  clinician: one(users, {
    fields: [users.clinicianUserId],
    references: [users.workosUserId],
    relationName: "clinician_patients",
  }),
  patients: many(users, {
    relationName: "clinician_patients",
  }),
  treatmentPlans: many(treatmentPlans),
  sessionTimes: many(sessionTimes),
  pushSubscriptions: many(pushSubscriptions),
  sentMessages: many(messages),
  conversationParticipants: many(conversationParticipants),
  patientConversations: many(conversations, {
    relationName: "patient_conversations",
  }),
  clinicianConversations: many(conversations, {
    relationName: "clinician_conversations",
  }),
  performedReps: many(performedReps),
}));
