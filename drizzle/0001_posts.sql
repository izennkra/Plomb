CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`image_url` text,
	`published_at` integer,
	`discovered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`content` text,
	`method` text NOT NULL,
	`before_subscription` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_source_url_unique` ON `posts` (`source_id`,`url`);--> statement-breakpoint
CREATE INDEX `posts_source_idx` ON `posts` (`source_id`,`discovered_at`);--> statement-breakpoint
ALTER TABLE `sources` ADD `fetch_method` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `feed_url` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `last_fetched_at` integer;--> statement-breakpoint
ALTER TABLE `sources` ADD `last_fetch_status` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `last_fetch_message` text;