ALTER TABLE "vestibulon2_rep" ADD COLUMN IF NOT EXISTS "program_id" integer;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'vestibulon2_rep_program_id_vestibulon2_program_id_fk'
	) THEN
		ALTER TABLE "vestibulon2_rep"
		ADD CONSTRAINT "vestibulon2_rep_program_id_vestibulon2_program_id_fk"
		FOREIGN KEY ("program_id")
		REFERENCES "public"."vestibulon2_program"("id")
		ON DELETE cascade
		ON UPDATE no action;
	END IF;
END
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rep_program_idx" ON "vestibulon2_rep" USING btree ("program_id");