import { defineConfig } from "drizzle-kit";

import { databaseEnv } from "./src/env";

export default defineConfig({
	casing: "snake_case",
	dbCredentials: {
		url: databaseEnv.DATABASE_URL,
	},
	dialect: "postgresql",
	migrations: {
		prefix: "timestamp",
	},
	out: "migrations",
	schema: "./src/schema/*.ts",
	strict: true,
	verbose: true,
});
