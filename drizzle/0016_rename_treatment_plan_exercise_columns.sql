ALTER TABLE "vestibulon2_treatment_plan_exercises"
  RENAME COLUMN "exercise_name" TO "exercise_code";
--> statement-breakpoint
ALTER TABLE "vestibulon2_treatment_plan_exercises"
  RENAME COLUMN "number_of_repetions" TO "reps_per_session";
--> statement-breakpoint
ALTER TABLE "vestibulon2_treatment_plan_exercises"
  RENAME COLUMN "number_of_seconds" TO "seconds_per_rep";
--> statement-breakpoint
ALTER TABLE "vestibulon2_treatment_plan_exercises"
  RENAME COLUMN "metronome_bpm" TO "target_bpm";
--> statement-breakpoint
ALTER TABLE "vestibulon2_treatment_plan_exercises"
  RENAME COLUMN "recomended_vas" TO "recommended_vas";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_exercises_name_idx"
  RENAME TO "treatment_plan_exercises_code_idx";
