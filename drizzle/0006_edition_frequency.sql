ALTER TABLE `users` ADD `edition_frequency` text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `edition_weekdays` text DEFAULT '[1,2,3,4,5]' NOT NULL;