ALTER TABLE `edition_items` ADD `subject` text;--> statement-breakpoint
ALTER TABLE `edition_items` ADD `criteria` text;--> statement-breakpoint
ALTER TABLE `edition_items` ADD `covered_by` text DEFAULT '[]' NOT NULL;