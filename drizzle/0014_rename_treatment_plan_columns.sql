DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plans'
      AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plans'
      AND column_name = 'patient_user_id'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plans"
      RENAME COLUMN "user_id" TO "patient_user_id";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plans'
      AND column_name = 'created_by'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plans'
      AND column_name = 'clinician_user_id'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plans"
      RENAME COLUMN "created_by" TO "clinician_user_id";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plans'
      AND column_name = 'number_of_sessions'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plans'
      AND column_name = 'sessions_per_day'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plans"
      RENAME COLUMN "number_of_sessions" TO "sessions_per_day";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plans_user_id_vestibulon2_users_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plans_patient_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plans"
      RENAME CONSTRAINT "vestibulon2_treatment_plans_user_id_vestibulon2_users_workos_user_id_fk" TO "vestibulon2_treatment_plans_patient_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plans_created_by_vestibulon2_users_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plans_clinician_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plans"
      RENAME CONSTRAINT "vestibulon2_treatment_plans_created_by_vestibulon2_users_workos_user_id_fk" TO "vestibulon2_treatment_plans_clinician_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plans_user_effective_idx" RENAME TO "treatment_plans_patient_user_effective_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plans_user_idx" RENAME TO "treatment_plans_patient_user_idx";
