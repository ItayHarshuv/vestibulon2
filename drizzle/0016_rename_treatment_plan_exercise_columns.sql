DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'exercise_name'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'exercise_code'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan_exercises"
      RENAME COLUMN "exercise_name" TO "exercise_code";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'number_of_repetions'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'reps_per_session'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan_exercises"
      RENAME COLUMN "number_of_repetions" TO "reps_per_session";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'number_of_seconds'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'seconds_per_rep'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan_exercises"
      RENAME COLUMN "number_of_seconds" TO "seconds_per_rep";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'metronome_bpm'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'target_bpm'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan_exercises"
      RENAME COLUMN "metronome_bpm" TO "target_bpm";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'recomended_vas'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_treatment_plan_exercises'
      AND column_name = 'recommended_vas'
  ) THEN
    ALTER TABLE "public"."vestibulon2_treatment_plan_exercises"
      RENAME COLUMN "recomended_vas" TO "recommended_vas";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "treatment_plan_exercises_name_idx" RENAME TO "treatment_plan_exercises_code_idx";
