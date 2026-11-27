CREATE TABLE `daily_closes` (
	`ticker` text NOT NULL,
	`date` text NOT NULL,
	`price_cents` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_closes_symbol_day` ON `daily_closes` (`ticker`,`date`);