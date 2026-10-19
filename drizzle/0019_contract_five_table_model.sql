DROP TABLE IF EXISTS "vestibulon2_today_reps";
--> statement-breakpoint
DROP TABLE IF EXISTS "vestibulon2_prescribed_exercise_history";
--> statement-breakpoint
DROP TABLE IF EXISTS "vestibulon2_user_session_history";
--> statement-breakpoint
DROP TABLE IF EXISTS "vestibulon2_prescribed_exercises";
--> statement-breakpoint
ALTER TABLE "vestibulon2_users"
  DROP COLUMN IF EXISTS "number_of_sessions";
--> statement-breakpoint
ALTER TABLE "vestibulon2_treatment_plans"
  DROP COLUMN IF EXISTS "effective_from";
--> statement-breakpoint
ALTER TABLE "vestibulon2_performed_reps"
  DROP COLUMN IF EXISTS "exercise_name";
