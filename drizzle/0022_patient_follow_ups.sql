ALTER TABLE "vestibulon2_messages" ADD COLUMN "patient_push_sent_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "vestibulon2_patient_practice_reviews" (
  "patient_user_id" varchar(256) NOT NULL REFERENCES "vestibulon2_users"("workos_user_id") ON DELETE cascade,
  "clinician_user_id" varchar(256) NOT NULL REFERENCES "vestibulon2_users"("workos_user_id") ON DELETE cascade,
  "view_id" uuid NOT NULL,
  "reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "patient_practice_reviews_view_uidx" ON "vestibulon2_patient_practice_reviews" ("patient_user_id", "clinician_user_id", "view_id");
--> statement-breakpoint
CREATE TABLE "vestibulon2_practice_review_notifications" (
  "patient_user_id" varchar(256) NOT NULL REFERENCES "vestibulon2_users"("workos_user_id") ON DELETE cascade,
  "clinician_user_id" varchar(256) NOT NULL REFERENCES "vestibulon2_users"("workos_user_id") ON DELETE cascade,
  "request_id" uuid NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "practice_review_notifications_request_uidx" ON "vestibulon2_practice_review_notifications" ("patient_user_id", "clinician_user_id", "request_id");
--> statement-breakpoint
CREATE TABLE "vestibulon2_patient_app_usage_intervals" (
  "patient_user_id" varchar(256) NOT NULL REFERENCES "vestibulon2_users"("workos_user_id") ON DELETE cascade,
  "interval_id" uuid NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone NOT NULL,
  CONSTRAINT "patient_app_usage_interval_duration" CHECK ("ended_at" > "started_at" AND "ended_at" <= "started_at" + interval '30 seconds')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "patient_app_usage_intervals_interval_uidx" ON "vestibulon2_patient_app_usage_intervals" ("patient_user_id", "interval_id");
--> statement-breakpoint
CREATE INDEX "patient_app_usage_intervals_started_idx" ON "vestibulon2_patient_app_usage_intervals" ("patient_user_id", "started_at");
