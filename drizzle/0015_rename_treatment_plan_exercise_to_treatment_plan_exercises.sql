ALTER TABLE IF EXISTS "vestibulon2_treatment_plan_exercise"
  RENAME TO "vestibulon2_treatment_plan_exercises";
--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "vestibulon2_treatment_plan_exercise_id_seq"
  RENAME TO "vestibulon2_treatment_plan_exercises_id_seq";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_exercise_plan_idx"
  RENAME TO "treatment_plan_exercises_plan_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_exercise_name_idx"
  RENAME TO "treatment_plan_exercises_name_idx";
