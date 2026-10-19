ALTER TABLE "vestibulon2_performed_reps"
  RENAME COLUMN "user_id" TO "patient_user_id";
--> statement-breakpoint
ALTER TABLE "vestibulon2_performed_reps"
  RENAME COLUMN "prescribed_exercise_id" TO "treatment_plan_exercise_id";
--> statement-breakpoint
ALTER TABLE "vestibulon2_performed_reps"
  DROP CONSTRAINT IF EXISTS "vestibulon2_rep_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk";
--> statement-breakpoint
ALTER TABLE "vestibulon2_performed_reps"
  DROP CONSTRAINT IF EXISTS "vestibulon2_performed_reps_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk";
--> statement-breakpoint
ALTER INDEX IF EXISTS "performed_reps_prescribed_exercise_idx"
  RENAME TO "performed_reps_treatment_plan_exercise_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "performed_reps_user_exercise_idx"
  RENAME TO "performed_reps_patient_user_exercise_idx";
