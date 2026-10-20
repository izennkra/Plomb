CREATE TABLE `social_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`actor` text NOT NULL,
	`run_id` text NOT NULL,
	`dataset_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	`message` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_runs_status_idx` ON `social_runs` (`status`,`source_id`);