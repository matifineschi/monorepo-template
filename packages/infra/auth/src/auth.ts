import { betterAuth, type User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db, schema } from "@repo/db/client";

import { authEnv as env } from "./env";

/**
 * What the business layer plugs into better-auth. This package owns the
 * *connection* — the adapter, the tables, the secret — and knows nothing about
 * what should happen when a user signs up or forgets a password. That lives in
 * `@repo/features/auth`, which is the only caller of `createAuth`.
 */
export type AuthOptions = {
	/** Lifetime of a password-reset link. better-auth's default is one hour. */
	resetPasswordTokenExpiresIn?: number;
	/** Runs after better-auth has inserted the `user_auth.users` row. */
	onUserCreated?: (user: User) => Promise<void>;
	/**
	 * Delivers the reset link. Must return promptly: better-auth awaits it, and
	 * a slow hook makes "this address has an account" measurable from outside.
	 */
	sendResetPassword?: (data: {
		user: User;
		url: string;
		token: string;
	}) => Promise<void>;
};

export function createAuth(options: AuthOptions = {}) {
	const { onUserCreated, sendResetPassword, resetPasswordTokenExpiresIn } =
		options;

	return betterAuth({
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
					after: async (user) => {
						await onUserCreated?.(user);
					},
				},
			},
		},
		emailAndPassword: {
			enabled: true,
			sendResetPassword,
			resetPasswordTokenExpiresIn,
			// A reset is how someone recovers a compromised account, so every
			// session the attacker might hold has to die with the old password.
			revokeSessionsOnPasswordReset: true,
		},
		secret: env.BETTER_AUTH_SECRET,
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
