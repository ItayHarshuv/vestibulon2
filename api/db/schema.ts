// Shared Drizzle schema (used by Vercel functions + local dev)
// Keep this as the single source of truth.

import { relations } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `vestibulon2_${name}`);

export const programs = createTable(
  "program",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d.varchar("user_id", { length: 256 }).notNull(),
    exerciseName: d.varchar("exercise_name", { length: 256 }).notNull(),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    numberOfSeconds: d.integer("number_of_seconds").notNull(),
    numberOfRepetions: d.integer("number_of_repetions").notNull(),
    metronomeBpm: d.integer("metronome_bpm").notNull(),
    metronomeBpmTemp: d.integer("metronome_bpm_temp"),
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

export const programsRelations = relations(programs, ({ many }) => ({
  reps: many(reps),
}));

export const repsRelations = relations(reps, ({ one }) => ({
  program: one(programs, {
    fields: [reps.programId],
    references: [programs.id],
  }),
}));

export const userProfiles = createTable(
  "user_profile",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    workosUserId: d.varchar("workos_user_id", { length: 256 }).notNull().unique(),
    username: d.varchar("username", { length: 256 }).notNull().unique(),
    email: d.varchar("email", { length: 256 }).notNull().unique(),
    gender: d.varchar("gender", { length: 16 }),
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
    index("user_profile_workos_user_idx").on(t.workosUserId),
    index("user_profile_username_idx").on(t.username),
    index("user_profile_email_idx").on(t.email),
  ],
);
