ALTER TABLE "vestibulon2_treatment_plans"
  RENAME COLUMN "user_id" TO "patient_user_id";
--> statement-breakpoint
ALTER TABLE "vestibulon2_treatment_plans"
  RENAME COLUMN "created_by" TO "clinician_user_id";
--> statement-breakpoint
ALTER TABLE "vestibulon2_treatment_plans"
  RENAME COLUMN "number_of_sessions" TO "sessions_per_day";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plans_user_effective_idx"
  RENAME TO "treatment_plans_patient_user_effective_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plans_user_idx"
  RENAME TO "treatment_plans_patient_user_idx";
