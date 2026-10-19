ALTER TABLE IF EXISTS "vestibulon2_treatment_plan"
  RENAME TO "vestibulon2_treatment_plans";
--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "vestibulon2_treatment_plan_id_seq"
  RENAME TO "vestibulon2_treatment_plans_id_seq";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_user_effective_idx"
  RENAME TO "treatment_plans_user_effective_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_user_idx"
  RENAME TO "treatment_plans_user_idx";
