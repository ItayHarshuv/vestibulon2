DO $$ BEGIN
  IF to_regclass('public.vestibulon2_treatment_plan') IS NOT NULL
    AND to_regclass('public.vestibulon2_treatment_plans') IS NULL THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan" RENAME TO "vestibulon2_treatment_plans";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.vestibulon2_treatment_plan_id_seq') IS NOT NULL
    AND to_regclass('public.vestibulon2_treatment_plans_id_seq') IS NULL THEN
    ALTER SEQUENCE "public"."vestibulon2_treatment_plan_id_seq" RENAME TO "vestibulon2_treatment_plans_id_seq";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_pkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plans_pkey'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plans"
      RENAME CONSTRAINT "vestibulon2_treatment_plan_pkey" TO "vestibulon2_treatment_plans_pkey";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_user_id_vestibulon2_users_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plans_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plans"
      RENAME CONSTRAINT "vestibulon2_treatment_plan_user_id_vestibulon2_users_workos_user_id_fk" TO "vestibulon2_treatment_plans_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_created_by_vestibulon2_users_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plans_created_by_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plans"
      RENAME CONSTRAINT "vestibulon2_treatment_plan_created_by_vestibulon2_users_workos_user_id_fk" TO "vestibulon2_treatment_plans_created_by_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_user_effective_idx" RENAME TO "treatment_plans_user_effective_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_user_idx" RENAME TO "treatment_plans_user_idx";
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_exercise_treatment_plan_id_vestibulon2_treatment_plan_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_exercise_treatment_plan_id_vestibulon2_treatment_plans_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan_exercise"
      RENAME CONSTRAINT "vestibulon2_treatment_plan_exercise_treatment_plan_id_vestibulon2_treatment_plan_id_fk" TO "vestibulon2_treatment_plan_exercise_treatment_plan_id_vestibulon2_treatment_plans_id_fk";
  END IF;
END $$;
