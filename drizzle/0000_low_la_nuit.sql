CREATE TABLE `dividends` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`user_id` text NOT NULL,
	`ticker` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`portfolio_id`,`user_id`) REFERENCES `portfolios`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "dividends_positive_amount" CHECK("dividends"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `dividends_user_portfolio_idx` ON `dividends` (`user_id`,`portfolio_id`);--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `portfolios_user_idx` ON `portfolios` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `portfolios_id_user_idx` ON `portfolios` (`id`,`user_id`);--> statement-breakpoint
CREATE TABLE `request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_limits_expiry_idx` ON `request_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`portfolio_id` text NOT NULL,
	`user_id` text NOT NULL,
	`ticker` text NOT NULL,
	`type` text NOT NULL,
	`quantity_micros` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`fee_cents` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`portfolio_id`,`user_id`) REFERENCES `portfolios`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "transactions_positive_quantity" CHECK("transactions"."quantity_micros" > 0),
	CONSTRAINT "transactions_positive_price" CHECK("transactions"."price_cents" > 0),
	CONSTRAINT "transactions_nonnegative_fee" CHECK("transactions"."fee_cents" >= 0),
	CONSTRAINT "transactions_valid_type" CHECK("transactions"."type" IN ('BUY', 'SELL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_id_unique` ON `transactions` (`id`);--> statement-breakpoint
CREATE INDEX `transactions_ledger_idx` ON `transactions` (`user_id`,`portfolio_id`,`ticker`,`occurred_at`,`sequence`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_expiry_idx` ON `users` (`is_demo`,`expires_at`);