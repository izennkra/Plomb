ALTER TABLE `editions` ADD `publish_at` integer;--> statement-breakpoint
ALTER TABLE `editions` ADD `email_sent_at` integer;--> statement-breakpoint
ALTER TABLE `editions` ADD `alert_sent_at` integer;--> statement-breakpoint
ALTER TABLE `editions` ADD `attempts` integer DEFAULT 0 NOT NULL;