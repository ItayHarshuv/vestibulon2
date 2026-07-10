DO $$ BEGIN
  IF to_regclass('public.vestibulon2_rep') IS NOT NULL
    AND to_regclass('public.vestibulon2_performed_reps') IS NULL THEN
    ALTER TABLE "public"."vestibulon2_rep" RENAME TO "vestibulon2_performed_reps";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.vestibulon2_rep_id_seq') IS NOT NULL
    AND to_regclass('public.vestibulon2_performed_reps_id_seq') IS NULL THEN
    ALTER SEQUENCE "public"."vestibulon2_rep_id_seq" RENAME TO "vestibulon2_performed_reps_id_seq";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_rep_pkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_performed_reps_pkey'
  ) THEN
    ALTER TABLE "public"."vestibulon2_performed_reps"
      RENAME CONSTRAINT "vestibulon2_rep_pkey" TO "vestibulon2_performed_reps_pkey";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_rep_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_performed_reps_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_performed_reps"
      RENAME CONSTRAINT "vestibulon2_rep_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk" TO "vestibulon2_performed_reps_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "rep_prescribed_exercise_idx" RENAME TO "performed_reps_prescribed_exercise_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "rep_user_exercise_idx" RENAME TO "performed_reps_user_exercise_idx";
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_today_reps'
      AND column_name = 'rep_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_today_reps'
      AND column_name = 'performed_rep_id'
  ) THEN
    ALTER TABLE "public"."vestibulon2_today_reps"
      RENAME COLUMN "rep_id" TO "performed_rep_id";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_today_reps_rep_id_vestibulon2_rep_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_today_reps_performed_rep_id_vestibulon2_performed_reps_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_today_reps"
      RENAME CONSTRAINT "vestibulon2_today_reps_rep_id_vestibulon2_rep_id_fk" TO "vestibulon2_today_reps_performed_rep_id_vestibulon2_performed_reps_id_fk";
  END IF;
END $$;
