ALTER TABLE "vestibulon2_user_profile" ADD COLUMN "role" varchar(32) DEFAULT 'patient' NOT NULL;--> statement-breakpoint
ALTER TABLE "vestibulon2_user_profile" ADD COLUMN "clinician_user_id" varchar(256);--> statement-breakpoint
ALTER TABLE "vestibulon2_user_profile" ADD CONSTRAINT "vestibulon2_user_profile_clinician_user_id_vestibulon2_user_profile_workos_user_id_fk" FOREIGN KEY ("clinician_user_id") REFERENCES "public"."vestibulon2_user_profile"("workos_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_profile_role_idx" ON "vestibulon2_user_profile" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_profile_clinician_user_idx" ON "vestibulon2_user_profile" USING btree ("clinician_user_id");