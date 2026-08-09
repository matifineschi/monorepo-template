import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseEnv } from "./env";
import { schema } from "./schema/index";

const client = postgres(databaseEnv.DATABASE_URL);

export const db = drizzle<typeof schema>(client, {
	casing: "snake_case",
	schema,
});

export { schema };
