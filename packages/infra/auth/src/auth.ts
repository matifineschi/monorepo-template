import { db, schema } from "@repo/db/client";
import { createUser } from "@repo/db/operations/users";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { authEnv as env } from "./env";

export const auth = betterAuth({
	advanced: {
		database: {
			generateId: "uuid",
		},
	},
	baseURL: env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			accounts: schema.userAuthAccounts,
			sessions: schema.userAuthSessions,
			users: schema.userAuthUsers,
			verifications: schema.userAuthVerifications,
		},
		usePlural: true,
	}),
	databaseHooks: {
		user: {
			create: {
				after: async (user, _context) => {
					await createUser({
						id: user.id,
						name: user.name,
						email: user.email,
					});
				},
			},
		},
	},
	emailAndPassword: {
		enabled: true,
	},
	secret: env.BETTER_AUTH_SECRET,
});

export type Session = typeof auth.$Infer.Session;
