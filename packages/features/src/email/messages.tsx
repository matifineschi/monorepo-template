import type { EmailMessage, SendEmailCode, SentEmail } from "@repo/email";
import { sendEmail } from "@repo/email";
import type { SendWelcomeEmailJob } from "@repo/queues";
import { createError } from "@repo/utils/error";
import type { Result } from "@repo/utils/result";

import { emailQueue } from "../shared/queues";
import { getNameParts } from "../users/name-parts";
import PasswordResetEmail from "./templates/password-reset";
import WelcomeEmail from "./templates/welcome";
import { brand } from "./theme";

/** Delivery, injectable so a test can capture the message instead of sending it. */
export type Deliver = (
	message: EmailMessage,
) => Promise<Result<SentEmail, SendEmailCode>>;

export async function sendPasswordResetEmail(
	input: {
		to: string;
		name: string;
		resetUrl: string;
		/** better-auth's one-time token: one reset attempt, one email. */
		token: string;
		expiresInMinutes: number;
	},
	deliver: Deliver = sendEmail,
): Promise<Result<SentEmail, SendEmailCode>> {
	const { firstName } = getNameParts({ name: input.name, email: input.to });

	return deliver({
		to: input.to,
		subject: "Reset your password",
		react: (
			<PasswordResetEmail
				firstName={firstName}
				resetUrl={input.resetUrl}
				expiresInMinutes={input.expiresInMinutes}
			/>
		),
		idempotencyKey: `password-reset/${input.token}`,
		tags: [{ name: "category", value: "password-reset" }],
	});
}

export type WelcomeEmailInput = Omit<SendWelcomeEmailJob, "type">;

export async function sendWelcomeEmail(
	input: WelcomeEmailInput,
	deliver: Deliver = sendEmail,
): Promise<Result<SentEmail, SendEmailCode>> {
	const { firstName } = getNameParts({ name: input.name, email: input.email });

	return deliver({
		to: input.email,
		subject: `Welcome to ${brand.name}`,
		react: (
			<WelcomeEmail
				firstName={firstName}
				dashboardUrl={new URL("/dashboard", input.appUrl).toString()}
			/>
		),
		idempotencyKey: `welcome-user/${input.userId}`,
		tags: [{ name: "category", value: "welcome" }],
	});
}

/**
 * Hands the welcome email to `apps/workers`, so sign-up never waits on (or
 * fails because of) the mail provider, and a Resend outage is retried by
 * BullMQ instead of lost.
 *
 * The job id makes a repeat enqueue for the same user a no-op, matching the
 * idempotency key the send itself carries.
 */
export async function enqueueWelcomeEmail(input: WelcomeEmailInput) {
	await emailQueue().add(
		"send-welcome-email",
		{ type: "send-welcome-email", ...input },
		{ jobId: `welcome-${input.userId}` },
	);
}

/**
 * The email queue's job body, called by `apps/workers` with no BullMQ or Redis
 * anywhere near it.
 *
 * Throws only for a failure worth retrying. A rejection (an unverified sender,
 * a restricted key) fails identically on every attempt and is already logged
 * with Resend's reason, so retrying it would only repeat the noise.
 */
export async function processEmailJob(
	data: SendWelcomeEmailJob,
	deliver: Deliver = sendEmail,
): Promise<void> {
	const { type } = data;

	switch (type) {
		case "send-welcome-email": {
			const result = await sendWelcomeEmail(data, deliver);
			if (!result.ok && result.code === "unavailable") {
				throw createError("Welcome email not delivered", {
					context: { userId: data.userId },
				});
			}
			break;
		}
		default: {
			const _exhaustive: never = type;
			throw createError("Unknown email job type", {
				context: { type: String(_exhaustive) },
			});
		}
	}
}
