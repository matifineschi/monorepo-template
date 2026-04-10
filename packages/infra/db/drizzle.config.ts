import { defineConfig } from "drizzle-kit";

export default defineConfig({
	casing: "snake_case",
	dbCredentials: {
		url: process.env.DATABASE_URL as string,
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
