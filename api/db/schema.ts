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

export const programs = createTable(
  "program",
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
  (t) => [index("program_user_exercise_idx").on(t.userId, t.exerciseName)],
);

export const reps = createTable(
  "rep",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    programId: d.integer("program_id").references(() => programs.id, {
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
    index("rep_program_idx").on(t.programId),
    index("rep_user_exercise_idx").on(t.userId, t.exerciseName),
  ],
);

export const programHistory = createTable(
  "program_history",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    programId: d
      .integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
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
    index("program_history_program_effective_idx").on(t.programId, t.effectiveFrom),
    index("program_history_user_exercise_idx").on(t.userId, t.exerciseName),
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
    repId: d.integer("rep_id").references(() => reps.id, {
      onDelete: "set null",
    }),
  }),
  (t) => [
    index("today_rep_user_practice_idx").on(t.userId, t.practiceTime),
    index("today_rep_user_exercise_idx").on(t.userId, t.exerciseName),
  ],
);

export const programsRelations = relations(programs, ({ many, one }) => ({
  user: one(users, {
    fields: [programs.userId],
    references: [users.workosUserId],
  }),
  reps: many(reps),
  history: many(programHistory),
}));

export const programHistoryRelations = relations(programHistory, ({ one }) => ({
  program: one(programs, {
    fields: [programHistory.programId],
    references: [programs.id],
  }),
}));

export const userSessionHistoryRelations = relations(userSessionHistory, ({ one }) => ({
  user: one(users, {
    fields: [userSessionHistory.userId],
    references: [users.workosUserId],
  }),
}));

export const repsRelations = relations(reps, ({ one }) => ({
  program: one(programs, {
    fields: [reps.programId],
    references: [programs.id],
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
  programs: many(programs),
  sessionHistory: many(userSessionHistory),
  treatmentPlans: many(treatmentPlans),
}));
