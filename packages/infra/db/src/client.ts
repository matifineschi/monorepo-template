import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { schema } from "./schema/index";

if (!process.env.DATABASE_URL) {
	throw new Error("Missing required environment variable: DATABASE_URL");
}

const client = postgres(process.env.DATABASE_URL);

export const db = drizzle<typeof schema>(client, {
	casing: "snake_case",
	schema,
});

export { schema };
