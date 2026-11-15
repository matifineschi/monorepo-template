import { createAuth, type Session } from "@repo/auth";
import { authEnv } from "@repo/auth/env";
import { childLogger } from "@repo/logger";
import { err, ok, type Result, tryAsyncResult } from "@repo/utils/result";

import { enqueueWelcomeEmail, sendPasswordResetEmail } from "../email/messages";
import { provisionUser } from "../users";

export type { Session };

const log = childLogger({ feature: "auth" });

const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

/**
 * The application's better-auth instance. `@repo/auth` owns the connection
 * (adapter, tables, secret); what happens on sign-up and on a reset request is
 * business logic, so it is wired here.
 */
const auth = createAuth({
	resetPasswordTokenExpiresIn: PASSWORD_RESET_TTL_SECONDS,
	onUserCreated: async (user) => {
		// A failure here fails the sign-up on purpose: an account without its
		// profile row is broken for every page that reads one.
		await provisionUser(user);

		// The welcome email must never block or fail sign-up.
		const queued = await tryAsyncResult(() =>
			enqueueWelcomeEmail({
				userId: user.id,
				email: user.email,
				name: user.name,
				appUrl: authEnv.BETTER_AUTH_URL,
			}),
		);
		if (!queued.ok) {
			log.error(
				{ userId: user.id, err: queued.error },
				"Welcome email not enqueued",
			);
		}
	},
	sendResetPassword: async ({ user, url, token }) => {
		// Not awaited: better-auth awaits this hook, and a request for a real
		// account taking a Resend round-trip longer than one for an unknown
		// address would reveal which addresses have accounts.
		void sendPasswordResetEmail({
			to: user.email,
			name: user.name,
			resetUrl: url,
			token,
			expiresInMinutes: PASSWORD_RESET_TTL_SECONDS / 60,
		}).then((sent) => {
			if (!sent.ok) {
				log.error(
					{ userId: user.id, code: sent.code },
					"Password reset email not sent",
				);
			}
		});
	},
});

/** Mount at `/api/auth/*` in any app that serves auth routes. */
export function authHandler(request: Request): Promise<Response> {
	return auth.handler(request);
}

/** The session for an incoming request's cookies, or null when signed out. */
export async function getSession(headers: Headers): Promise<Session | null> {
	return auth.api.getSession({ headers });
}

/**
 * A successful sign-in or sign-up carries the response headers, because the
 * `Set-Cookie` in them is the session. How cookies reach the browser is the
 * caller's framework's business, not this layer's.
 */
export type AuthSuccess = { headers: Headers };

export type SignInCode = "invalid-credentials" | "failed";
export type SignUpCode = "email-taken" | "invalid-password" | "failed";
export type ResetPasswordCode = "invalid-token" | "invalid-password" | "failed";

export async function signInWithEmail(
	input: { email: string; password: string },
	headers: Headers,
): Promise<Result<AuthSuccess, SignInCode>> {
	const response = await auth.api.signInEmail({
		asResponse: true,
		body: input,
		headers,
	});
	if (response.ok) return ok({ headers: response.headers });

	const code = await errorCode(response);
	return code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_EMAIL"
		? err("invalid-credentials")
		: failed("Sign-in failed", code);
}

export async function signUpWithEmail(
	input: { email: string; password: string; name: string },
	headers: Headers,
): Promise<Result<AuthSuccess, SignUpCode>> {
	const response = await auth.api.signUpEmail({
		asResponse: true,
		body: input,
		headers,
	});
	if (response.ok) return ok({ headers: response.headers });

	const code = await errorCode(response);
	switch (code) {
		case "USER_ALREADY_EXISTS":
		case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
			return err("email-taken");
		case "PASSWORD_TOO_SHORT":
		case "PASSWORD_TOO_LONG":
			return err("invalid-password");
		default:
			return failed("Sign-up failed", code);
	}
}

/**
 * Starts a reset. Succeeds whether or not the address has an account — the
 * caller must show the same message either way, or the form becomes a way to
 * test which addresses are registered.
 */
export async function requestPasswordReset(
	email: string,
	headers: Headers,
): Promise<Result<void, "failed">> {
	const response = await auth.api.requestPasswordReset({
		asResponse: true,
		body: {
			email,
			redirectTo: new URL("/reset-password", authEnv.BETTER_AUTH_URL).href,
		},
		headers,
	});
	if (response.ok) return ok(undefined);

	return failed("Password reset request failed", await errorCode(response));
}

/** Sets a new password and signs out every existing session. */
export async function resetPassword(
	input: { token: string; newPassword: string },
	headers: Headers,
): Promise<Result<void, ResetPasswordCode>> {
	const response = await auth.api.resetPassword({
		asResponse: true,
		body: input,
		headers,
	});
	if (response.ok) return ok(undefined);

	const code = await errorCode(response);
	switch (code) {
		case "INVALID_TOKEN":
			return err("invalid-token");
		case "PASSWORD_TOO_SHORT":
		case "PASSWORD_TOO_LONG":
			return err("invalid-password");
		default:
			return failed("Password reset failed", code);
	}
}

/** better-auth's machine-readable code from an error response body. */
async function errorCode(response: Response): Promise<string | undefined> {
	const body = await tryAsyncResult(
		() => response.json() as Promise<{ code?: unknown }>,
	);
	return body.ok && typeof body.value?.code === "string"
		? body.value.code
		: undefined;
}

function failed(message: string, code: string | undefined) {
	log.warn({ code }, message);
	return err("failed");
}
