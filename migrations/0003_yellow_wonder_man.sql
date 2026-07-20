ALTER TABLE "contacts" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "email" text;