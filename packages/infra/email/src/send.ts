import { render, toPlainText } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";

import { childLogger } from "@repo/logger";
import { err, ok, type Result, tryAsyncResult } from "@repo/utils/result";
import { withTimeout } from "@repo/utils/timeout";

import { emailEnv as env } from "./env";
import { isRetryable, retryDelayMs } from "./retry";

const log = childLogger({ module: "email" });

export type EmailMessage = {
	to: string | string[];
	subject: string;
	/** A React Email component instance, e.g. `<WelcomeEmail name="Ada" />`. */
	react: ReactElement;
	/**
	 * `<event>/<entity-id>`, e.g. `welcome-user/<userId>`. Resend drops a second
	 * request with the same key for 24h, which is what makes a retried job or a
	 * double-submitted form send one email, not two.
	 */
	idempotencyKey?: string;
	replyTo?: string;
	tags?: { name: string; value: string }[];
};

/** A message after rendering: what actually crosses the wire. */
export type RenderedEmail = Omit<EmailMessage, "react"> & {
	from: string;
	html: string;
	text: string;
};

export type SendEmailCode =
	/** Resend refused it and will refuse it again: bad sender, key, address. */
	| "rejected"
	/** Still failing after every retry: Resend down, network gone, rate limit. */
	| "unavailable";

export type SentEmail = { id: string };

/**
 * Where a rendered email goes. Injected so a test can assert on exactly what
 * would have been sent without a Resend account or a module mock.
 */
export type EmailTransport = (
	email: RenderedEmail,
) => Promise<Result<SentEmail, SendEmailCode>>;

/**
 * Renders and sends one email. Never throws for a delivery failure: the caller
 * decides whether a failed email fails its request (a password reset should
 * tell the user) or not (a welcome email must never block sign-up).
 */
export async function sendEmail(
	message: EmailMessage,
	transport: EmailTransport = defaultTransport(),
): Promise<Result<SentEmail, SendEmailCode>> {
	const html = await render(message.react);
	const { react: _react, ...rest } = message;

	return transport({
		...rest,
		from: env.EMAIL_FROM,
		html,
		text: toPlainText(html),
	});
}

function defaultTransport(): EmailTransport {
	return env.EMAIL_TRANSPORT === "resend" ? resendTransport() : logTransport;
}

/** Development and tests: the email lands in the log, rendered, never sent. */
export const logTransport: EmailTransport = async (email) => {
	const id = `log-${crypto.randomUUID()}`;
	log.info(
		{
			emailId: id,
			to: email.to,
			subject: email.subject,
			idempotencyKey: email.idempotencyKey,
			text: email.text,
		},
		"Email not sent (EMAIL_TRANSPORT=log)",
	);
	return ok({ id });
};

const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 10_000;

type ResendSend = Resend["emails"]["send"];

/**
 * Exported with an injectable `send` so the retry policy is testable against a
 * scripted sequence of responses rather than a live API.
 */
export function resendTransport(
	send: ResendSend = createClient(),
	sleep: (ms: number) => Promise<void> = delay,
): EmailTransport {
	return async (email) => {
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			const response = await tryAsyncResult(() =>
				withTimeout(
					send(
						{
							from: email.from,
							to: email.to,
							subject: email.subject,
							html: email.html,
							text: email.text,
							replyTo: email.replyTo,
							tags: email.tags,
						},
						email.idempotencyKey
							? { idempotencyKey: email.idempotencyKey }
							: undefined,
					),
					ATTEMPT_TIMEOUT_MS,
					"resend.emails.send",
				),
			);

			if (response.ok && response.value.data) {
				log.info(
					{ emailId: response.value.data.id, subject: email.subject },
					"Email sent",
				);
				return ok({ id: response.value.data.id });
			}

			// The SDK reports API and network errors in `error` (a network error
			// with a null status) and never throws for them; only our timeout
			// lands in the `!response.ok` branch.
			const failure = response.ok ? response.value.error : null;
			const statusCode = failure?.statusCode ?? null;
			const fields = {
				attempt: attempt + 1,
				statusCode,
				resendError: failure?.name,
				subject: email.subject,
				err: response.ok ? undefined : response.error,
			};

			if (!isRetryable(statusCode)) {
				// The message names the actual problem (an unverified domain, a
				// restricted key) and contains no secret, so it is worth logging.
				log.error({ ...fields, message: failure?.message }, "Email rejected");
				return err("rejected");
			}

			if (attempt + 1 < MAX_ATTEMPTS) {
				log.warn(fields, "Email send failed, retrying");
				await sleep(
					retryDelayMs(
						attempt,
						response.ok ? response.value.headers?.["retry-after"] : null,
					),
				);
			} else {
				log.error(fields, "Email send failed, giving up");
			}
		}

		return err("unavailable");
	};
}

/** Not `Bun.sleep`: the web app's server runs on Node. */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

let client: Resend | null = null;

/** Lazy, so importing this module never needs a key — only sending does. */
function createClient(): ResendSend {
	return (...args) => {
		client ??= new Resend(env.RESEND_API_KEY);
		return client.emails.send(...args);
	};
}
