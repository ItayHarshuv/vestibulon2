DO $$ BEGIN
  IF to_regclass('public.vestibulon2_program') IS NOT NULL
    AND to_regclass('public.vestibulon2_prescribed_exercises') IS NULL THEN
    ALTER TABLE "public"."vestibulon2_program" RENAME TO "vestibulon2_prescribed_exercises";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.vestibulon2_program_id_seq') IS NOT NULL
    AND to_regclass('public.vestibulon2_prescribed_exercises_id_seq') IS NULL THEN
    ALTER SEQUENCE "public"."vestibulon2_program_id_seq" RENAME TO "vestibulon2_prescribed_exercises_id_seq";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_program_pkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_prescribed_exercises_pkey'
  ) THEN
    ALTER TABLE "public"."vestibulon2_prescribed_exercises"
      RENAME CONSTRAINT "vestibulon2_program_pkey" TO "vestibulon2_prescribed_exercises_pkey";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_program_user_id_vestibulon2_users_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_prescribed_exercises_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_prescribed_exercises"
      RENAME CONSTRAINT "vestibulon2_program_user_id_vestibulon2_users_workos_user_id_fk" TO "vestibulon2_prescribed_exercises_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "program_user_exercise_idx" RENAME TO "prescribed_exercises_user_exercise_idx";
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_rep'
      AND column_name = 'program_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_rep'
      AND column_name = 'prescribed_exercise_id'
  ) THEN
    ALTER TABLE "public"."vestibulon2_rep"
      RENAME COLUMN "program_id" TO "prescribed_exercise_id";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_rep_program_id_vestibulon2_program_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_rep_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_rep"
      RENAME CONSTRAINT "vestibulon2_rep_program_id_vestibulon2_program_id_fk" TO "vestibulon2_rep_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "rep_program_idx" RENAME TO "rep_prescribed_exercise_idx";
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.vestibulon2_program_history') IS NOT NULL
    AND to_regclass('public.vestibulon2_prescribed_exercise_history') IS NULL THEN
    ALTER TABLE "public"."vestibulon2_program_history" RENAME TO "vestibulon2_prescribed_exercise_history";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.vestibulon2_program_history_id_seq') IS NOT NULL
    AND to_regclass('public.vestibulon2_prescribed_exercise_history_id_seq') IS NULL THEN
    ALTER SEQUENCE "public"."vestibulon2_program_history_id_seq" RENAME TO "vestibulon2_prescribed_exercise_history_id_seq";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_prescribed_exercise_history'
      AND column_name = 'program_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_prescribed_exercise_history'
      AND column_name = 'prescribed_exercise_id'
  ) THEN
    ALTER TABLE "public"."vestibulon2_prescribed_exercise_history"
      RENAME COLUMN "program_id" TO "prescribed_exercise_id";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_program_history_pkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_prescribed_exercise_history_pkey'
  ) THEN
    ALTER TABLE "public"."vestibulon2_prescribed_exercise_history"
      RENAME CONSTRAINT "vestibulon2_program_history_pkey" TO "vestibulon2_prescribed_exercise_history_pkey";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_program_history_program_id_vestibulon2_program_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_prescribed_exercise_history_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_prescribed_exercise_history"
      RENAME CONSTRAINT "vestibulon2_program_history_program_id_vestibulon2_program_id_fk" TO "vestibulon2_prescribed_exercise_history_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_program_history_user_id_vestibulon2_users_workos_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_prescribed_exercise_history_user_id_vestibulon2_users_workos_user_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_prescribed_exercise_history"
      RENAME CONSTRAINT "vestibulon2_program_history_user_id_vestibulon2_users_workos_user_id_fk" TO "vestibulon2_prescribed_exercise_history_user_id_vestibulon2_users_workos_user_id_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "program_history_program_effective_idx" RENAME TO "prescribed_exercise_history_prescribed_exercise_effective_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "program_history_user_exercise_idx" RENAME TO "prescribed_exercise_history_user_exercise_idx";
