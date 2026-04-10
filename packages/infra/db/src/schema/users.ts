import { eq, sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users as userAuthUsers } from "./user-auth";

const sessionUserId = sql`current_setting('app.user_id', true)::uuid`;

export const usersTable = pgTable(
	"users",

	{
		id: uuid()
			.primaryKey()
			.references(() => userAuthUsers.id, {
				onDelete: "restrict",
				onUpdate: "cascade",
			}),

		createdAt: timestamp().notNull().defaultNow(),
		updatedAt: timestamp().notNull().defaultNow(),

		firstName: text().notNull(),
		lastName: text().notNull(),
		mobile: text(),
	},
	(table) => [
		pgPolicy("users_all_own", {
			for: "all",
			using: eq(table.id, sessionUserId),
			withCheck: eq(table.id, sessionUserId),
		}),
	],
).enableRLS();
