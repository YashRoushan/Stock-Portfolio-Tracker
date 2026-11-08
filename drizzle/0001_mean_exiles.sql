CREATE TABLE `market_quotes` (
	`ticker` text PRIMARY KEY NOT NULL,
	`price_cents` integer,
	`change_cents` integer,
	`trading_day` text,
	`next_attempt_at` integer NOT NULL
);
