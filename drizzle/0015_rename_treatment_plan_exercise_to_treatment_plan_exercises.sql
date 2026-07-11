DO $$ BEGIN
  IF to_regclass('public.vestibulon2_treatment_plan_exercise') IS NOT NULL
    AND to_regclass('public.vestibulon2_treatment_plan_exercises') IS NULL THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan_exercise" RENAME TO "vestibulon2_treatment_plan_exercises";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.vestibulon2_treatment_plan_exercise_id_seq') IS NOT NULL
    AND to_regclass('public.vestibulon2_treatment_plan_exercises_id_seq') IS NULL THEN
    ALTER SEQUENCE "public"."vestibulon2_treatment_plan_exercise_id_seq" RENAME TO "vestibulon2_treatment_plan_exercises_id_seq";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_exercise_pkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_exercises_pkey'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan_exercises"
      RENAME CONSTRAINT "vestibulon2_treatment_plan_exercise_pkey" TO "vestibulon2_treatment_plan_exercises_pkey";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_exercise_treatment_plan_id_vestibulon2_treatment_plans_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_exercises_treatment_plan_id_vestibulon2_treatment_plans_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan_exercises"
      RENAME CONSTRAINT "vestibulon2_treatment_plan_exercise_treatment_plan_id_vestibulon2_treatment_plans_id_fk" TO "vestibulon2_treatment_plan_exercises_treatment_plan_id_vestibulon2_treatment_plans_id_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_exercise_plan_idx" RENAME TO "treatment_plan_exercises_plan_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_exercise_name_idx" RENAME TO "treatment_plan_exercises_name_idx";
