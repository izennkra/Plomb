CREATE TABLE `edition_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`post_id` integer,
	`position` integer NOT NULL,
	`placement` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`lead_text` text,
	`theme` text,
	`importance` integer,
	`url` text NOT NULL,
	`images` text NOT NULL,
	`source_name` text NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`fallback` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `edition_items_edition_idx` ON `edition_items` (`edition_id`,`position`);--> statement-breakpoint
CREATE TABLE `editions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`status` text DEFAULT 'building' NOT NULL,
	`model` text,
	`language` text DEFAULT 'fr' NOT NULL,
	`message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editions_user_day_unique` ON `editions` (`user_id`,`day`);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `favorite` integer DEFAULT false NOT NULL;