DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_performed_reps'
      AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_performed_reps'
      AND column_name = 'patient_user_id'
  ) THEN
    ALTER TABLE "public"."vestibulon2_performed_reps"
      RENAME COLUMN "user_id" TO "patient_user_id";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_performed_reps'
      AND column_name = 'prescribed_exercise_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_performed_reps'
      AND column_name = 'treatment_plan_exercise_id'
  ) THEN
    ALTER TABLE "public"."vestibulon2_performed_reps"
      RENAME COLUMN "prescribed_exercise_id" TO "treatment_plan_exercise_id";
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "public"."vestibulon2_performed_reps"
  DROP CONSTRAINT IF EXISTS "vestibulon2_rep_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk";
--> statement-breakpoint
ALTER TABLE "public"."vestibulon2_performed_reps"
  DROP CONSTRAINT IF EXISTS "vestibulon2_performed_reps_prescribed_exercise_id_vestibulon2_prescribed_exercises_id_fk";
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vestibulon2_performed_reps'
      AND column_name = 'treatment_plan_exercise_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vestibulon2_performed_reps_treatment_plan_exercise_id_vestibulon2_treatment_plan_exercises_id_fk'
  ) THEN
    ALTER TABLE "public"."vestibulon2_performed_reps"
      ADD CONSTRAINT "vestibulon2_performed_reps_treatment_plan_exercise_id_vestibulon2_treatment_plan_exercises_id_fk"
      FOREIGN KEY ("treatment_plan_exercise_id")
      REFERENCES "public"."vestibulon2_treatment_plan_exercises"("id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "performed_reps_prescribed_exercise_idx" RENAME TO "performed_reps_treatment_plan_exercise_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "performed_reps_user_exercise_idx" RENAME TO "performed_reps_patient_user_exercise_idx";
