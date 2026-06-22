DO $$ BEGIN
  IF to_regclass('public.vestibulon2_user_profile') IS NOT NULL
    AND to_regclass('public.vestibulon2_users') IS NULL THEN
    ALTER TABLE "public"."vestibulon2_user_profile" RENAME TO "vestibulon2_users";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.vestibulon2_user_profile_id_seq') IS NOT NULL
    AND to_regclass('public.vestibulon2_users_id_seq') IS NULL THEN
    ALTER SEQUENCE "public"."vestibulon2_user_profile_id_seq" RENAME TO "vestibulon2_users_id_seq";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_user_profile_pkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_users_pkey'
  ) THEN
    ALTER TABLE "public"."vestibulon2_users"
      RENAME CONSTRAINT "vestibulon2_user_profile_pkey" TO "vestibulon2_users_pkey";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_user_profile_workos_user_id_unique'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_users_workos_user_id_unique'
  ) THEN
    ALTER TABLE "public"."vestibulon2_users"
      RENAME CONSTRAINT "vestibulon2_user_profile_workos_user_id_unique" TO "vestibulon2_users_workos_user_id_unique";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_user_profile_username_unique'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_users_username_unique'
  ) THEN
    ALTER TABLE "public"."vestibulon2_users"
      RENAME CONSTRAINT "vestibulon2_user_profile_username_unique" TO "vestibulon2_users_username_unique";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_user_profile_email_unique'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_users_email_unique'
  ) THEN
    ALTER TABLE "public"."vestibulon2_users"
      RENAME CONSTRAINT "vestibulon2_user_profile_email_unique" TO "vestibulon2_users_email_unique";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_user_profile_clinician_user_id_vestibulon2_user_profile_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_users_clinician_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_users"
      RENAME CONSTRAINT "vestibulon2_user_profile_clinician_user_id_vestibulon2_user_profile_workos_user_id_fk" TO "vestibulon2_users_clinician_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "user_profile_workos_user_idx" RENAME TO "users_workos_user_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "user_profile_username_idx" RENAME TO "users_username_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "user_profile_email_idx" RENAME TO "users_email_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "user_profile_role_idx" RENAME TO "users_role_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "user_profile_clinician_user_idx" RENAME TO "users_clinician_user_idx";
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_program_user_id_vestibulon2_user_profile_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_program_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_program"
      RENAME CONSTRAINT "vestibulon2_program_user_id_vestibulon2_user_profile_workos_user_id_fk" TO "vestibulon2_program_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_today_reps_user_id_vestibulon2_user_profile_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_today_reps_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_today_reps"
      RENAME CONSTRAINT "vestibulon2_today_reps_user_id_vestibulon2_user_profile_workos_user_id_fk" TO "vestibulon2_today_reps_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_program_history_user_id_vestibulon2_user_profile_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_program_history_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_program_history"
      RENAME CONSTRAINT "vestibulon2_program_history_user_id_vestibulon2_user_profile_workos_user_id_fk" TO "vestibulon2_program_history_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_user_session_history_user_id_vestibulon2_user_profile_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_user_session_history_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_user_session_history"
      RENAME CONSTRAINT "vestibulon2_user_session_history_user_id_vestibulon2_user_profile_workos_user_id_fk" TO "vestibulon2_user_session_history_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_user_id_vestibulon2_user_profile_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan"
      RENAME CONSTRAINT "vestibulon2_treatment_plan_user_id_vestibulon2_user_profile_workos_user_id_fk" TO "vestibulon2_treatment_plan_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_created_by_vestibulon2_user_profile_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_treatment_plan_created_by_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan"
      RENAME CONSTRAINT "vestibulon2_treatment_plan_created_by_vestibulon2_user_profile_workos_user_id_fk" TO "vestibulon2_treatment_plan_created_by_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
