// Shared Drizzle schema (used by Vercel functions + local dev)
// Keep this as the single source of truth.

import { relations } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";
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
    numberOfSessions: d.integer("number_of_sessions").notNull().default(1),
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

export const prescribedExercises = createTable(
  "prescribed_exercises",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .varchar("user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId),
    exerciseName: d.varchar("exercise_name", { length: 256 }).notNull(),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    numberOfSeconds: d.integer("number_of_seconds").notNull(),
    numberOfRepetions: d.integer("number_of_repetions").notNull(),
    metronomeBpm: d.integer("metronome_bpm").notNull(),
    metronomeBpmTemp: d.integer("metronome_bpm_temp"),
    active: d.boolean("active").notNull().default(true),
    position: d.varchar("position", { length: 256 }).notNull(),
    background: d.varchar("background", { length: 256 }).notNull(),
    recomendedVAS: d.integer("recomended_vas").notNull(),
  }),
  (t) => [index("prescribed_exercises_user_exercise_idx").on(t.userId, t.exerciseName)],
);

export const performedReps = createTable(
  "performed_reps",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    prescribedExerciseId: d.integer("prescribed_exercise_id").references(() => prescribedExercises.id, {
      onDelete: "cascade",
    }),
    userId: d.varchar("user_id", { length: 256 }).notNull(),
    exerciseName: d.varchar("exercise_name", { length: 256 }).notNull(),
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
    index("performed_reps_prescribed_exercise_idx").on(t.prescribedExerciseId),
    index("performed_reps_user_exercise_idx").on(t.userId, t.exerciseName),
  ],
);

export const prescribedExerciseHistory = createTable(
  "prescribed_exercise_history",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    prescribedExerciseId: d
      .integer("prescribed_exercise_id")
      .notNull()
      .references(() => prescribedExercises.id, { onDelete: "cascade" }),
    userId: d
      .varchar("user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    exerciseName: d.varchar("exercise_name", { length: 256 }).notNull(),
    numberOfRepetions: d.integer("number_of_repetions").notNull(),
    active: d.boolean("active").notNull(),
    effectiveFrom: d
      .timestamp("effective_from", { withTimezone: true })
      .notNull(),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("prescribed_exercise_history_prescribed_exercise_effective_idx").on(t.prescribedExerciseId, t.effectiveFrom),
    index("prescribed_exercise_history_user_exercise_idx").on(t.userId, t.exerciseName),
  ],
);

export const userSessionHistory = createTable(
  "user_session_history",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .varchar("user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    numberOfSessions: d.integer("number_of_sessions").notNull(),
    effectiveFrom: d
      .timestamp("effective_from", { withTimezone: true })
      .notNull(),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("user_session_history_user_effective_idx").on(
      t.userId,
      t.effectiveFrom,
    ),
  ],
);

export const treatmentPlans = createTable(
  "treatment_plan",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .varchar("user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "cascade" }),
    createdBy: d
      .varchar("created_by", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, { onDelete: "restrict" }),
    numberOfSessions: d.integer("number_of_sessions").notNull(),
    effectiveFrom: d
      .timestamp("effective_from", { withTimezone: true })
      .notNull(),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("treatment_plan_user_effective_idx").on(t.userId, t.effectiveFrom),
    index("treatment_plan_user_idx").on(t.userId),
  ],
);

export const treatmentPlanExercises = createTable(
  "treatment_plan_exercise",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    treatmentPlanId: d
      .integer("treatment_plan_id")
      .notNull()
      .references(() => treatmentPlans.id, { onDelete: "cascade" }),
    exerciseName: d.varchar("exercise_name", { length: 256 }).notNull(),
    numberOfSeconds: d.integer("number_of_seconds").notNull(),
    numberOfRepetions: d.integer("number_of_repetions").notNull(),
    metronomeBpm: d.integer("metronome_bpm").notNull(),
    position: d.varchar("position", { length: 256 }).notNull(),
    background: d.varchar("background", { length: 256 }).notNull(),
    recomendedVAS: d.integer("recomended_vas").notNull(),
  }),
  (t) => [
    index("treatment_plan_exercise_plan_idx").on(t.treatmentPlanId),
    index("treatment_plan_exercise_name_idx").on(t.treatmentPlanId, t.exerciseName),
  ],
);

export const todayReps = createTable(
  "today_reps",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .varchar("user_id", { length: 256 })
      .notNull()
      .references(() => users.workosUserId, {
        onDelete: "cascade",
      }),
    practiceTime: d
      .timestamp("practice_time", { withTimezone: true })
      .notNull(),
    exerciseName: d.varchar("exercise_name", { length: 256 }).notNull(),
    performedRepId: d.integer("performed_rep_id").references(() => performedReps.id, {
      onDelete: "set null",
    }),
  }),
  (t) => [
    index("today_rep_user_practice_idx").on(t.userId, t.practiceTime),
    index("today_rep_user_exercise_idx").on(t.userId, t.exerciseName),
  ],
);

export const prescribedExercisesRelations = relations(prescribedExercises, ({ many, one }) => ({
  user: one(users, {
    fields: [prescribedExercises.userId],
    references: [users.workosUserId],
  }),
  performedReps: many(performedReps),
  history: many(prescribedExerciseHistory),
}));

export const prescribedExerciseHistoryRelations = relations(prescribedExerciseHistory, ({ one }) => ({
  prescribedExercise: one(prescribedExercises, {
    fields: [prescribedExerciseHistory.prescribedExerciseId],
    references: [prescribedExercises.id],
  }),
}));

export const userSessionHistoryRelations = relations(userSessionHistory, ({ one }) => ({
  user: one(users, {
    fields: [userSessionHistory.userId],
    references: [users.workosUserId],
  }),
}));

export const performedRepsRelations = relations(performedReps, ({ one }) => ({
  prescribedExercise: one(prescribedExercises, {
    fields: [performedReps.prescribedExerciseId],
    references: [prescribedExercises.id],
  }),
}));

export const treatmentPlansRelations = relations(treatmentPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [treatmentPlans.userId],
    references: [users.workosUserId],
  }),
  createdByUser: one(users, {
    fields: [treatmentPlans.createdBy],
    references: [users.workosUserId],
    relationName: "treatment_plan_creator",
  }),
  exercises: many(treatmentPlanExercises),
}));

export const treatmentPlanExercisesRelations = relations(
  treatmentPlanExercises,
  ({ one }) => ({
    treatmentPlan: one(treatmentPlans, {
      fields: [treatmentPlanExercises.treatmentPlanId],
      references: [treatmentPlans.id],
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
  prescribedExercises: many(prescribedExercises),
  sessionHistory: many(userSessionHistory),
  treatmentPlans: many(treatmentPlans),
}));
