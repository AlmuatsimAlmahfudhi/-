CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`unlocked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lang` text NOT NULL,
	`scenario_id` text NOT NULL,
	`transcript` text NOT NULL,
	`feedback` text,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `counters` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_quests` (
	`day` text NOT NULL,
	`quest_id` text NOT NULL,
	`target` integer NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`claimed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`day`, `quest_id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`item_id` text PRIMARY KEY NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `language_progress` (
	`lang` text PRIMARY KEY NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`current_level` text NOT NULL,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lesson_progress` (
	`lang` text NOT NULL,
	`lesson_id` text NOT NULL,
	`crowns` integer DEFAULT 0 NOT NULL,
	`best_accuracy` real DEFAULT 0 NOT NULL,
	`times_completed` integer DEFAULT 0 NOT NULL,
	`last_completed_at` integer,
	PRIMARY KEY(`lang`, `lesson_id`)
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT 'البطل' NOT NULL,
	`hero_class` text DEFAULT 'scholar' NOT NULL,
	`total_xp` integer DEFAULT 0 NOT NULL,
	`gems` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_streak_date` text,
	`daily_goal_xp` integer DEFAULT 50 NOT NULL,
	`xp_boost_until` integer,
	`active_lang` text DEFAULT 'en' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pronunciation_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lang` text NOT NULL,
	`target` text NOT NULL,
	`score` integer NOT NULL,
	`details` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_id` text NOT NULL,
	`rating` integer NOT NULL,
	`reviewed_at` integer NOT NULL,
	`elapsed_days` integer NOT NULL,
	`scheduled_days` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill_stats` (
	`lang` text NOT NULL,
	`attribute` text NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`lang`, `attribute`)
);
--> statement-breakpoint
CREATE TABLE `srs_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`lang` text NOT NULL,
	`item_id` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`reading` text,
	`due` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`elapsed_days` integer NOT NULL,
	`scheduled_days` integer NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`reps` integer NOT NULL,
	`lapses` integer NOT NULL,
	`state` integer NOT NULL,
	`last_review` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `srs_due_idx` ON `srs_cards` (`lang`,`due`);--> statement-breakpoint
CREATE TABLE `xp_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`lang` text,
	`amount` integer NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `xp_day_idx` ON `xp_events` (`day`);