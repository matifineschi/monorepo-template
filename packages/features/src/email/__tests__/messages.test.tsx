import { describe, expect, test } from "bun:test";

import { render } from "react-email";

import type { EmailMessage } from "@repo/email";

import type { Deliver } from "../messages";
import {
	processEmailJob,
	sendPasswordResetEmail,
	sendWelcomeEmail,
} from "../messages";
import { emailTheme } from "../theme";

function recording(result: Awaited<ReturnType<Deliver>> = okResult) {
	const sent: EmailMessage[] = [];
	const deliver: Deliver = async (message) => {
		sent.push(message);
		return result;
	};
	return { sent, deliver };
}

const okResult = { ok: true, value: { id: "em_1" } } as const;

const welcomeJob = {
	type: "send-welcome-email",
	userId: "user-1",
	email: "ada@example.test",
	name: "Ada Lovelace",
	appUrl: "http://localhost:3000",
} as const;

describe("sendWelcomeEmail", () => {
	test("greets by first name and links to the dashboard", async () => {
		const { sent, deliver } = recording();

		await sendWelcomeEmail(welcomeJob, deliver);

		const html = await render(sent[0]?.react);
		const text = await render(sent[0]?.react, { plainText: true });
		expect(sent[0]?.to).toBe("ada@example.test");
		expect(sent[0]?.subject).toBe("Welcome to Acme");
		expect(text).toContain("Hi Ada,");
		expect(html).toContain('href="http://localhost:3000/dashboard"');
	});

	/** A retried job must not send a second welcome email. */
	test("keys idempotency on the user", async () => {
		const { sent, deliver } = recording();

		await sendWelcomeEmail(welcomeJob, deliver);

		expect(sent[0]?.idempotencyKey).toBe("welcome-user/user-1");
	});
});

describe("sendPasswordResetEmail", () => {
	test("links to the reset url and keys idempotency on the token", async () => {
		const { sent, deliver } = recording();

		await sendPasswordResetEmail(
			{
				to: "ada@example.test",
				name: "Ada Lovelace",
				resetUrl: "http://localhost:3000/api/auth/reset-password/tok?x=1",
				token: "tok",
				expiresInMinutes: 60,
			},
			deliver,
		);

		const html = await render(sent[0]?.react);
		const text = await render(sent[0]?.react, { plainText: true });
		expect(sent[0]?.idempotencyKey).toBe("password-reset/tok");
		expect(html).toContain(
			'href="http://localhost:3000/api/auth/reset-password/tok?x=1"',
		);
		expect(text).toContain("expires in 60 minutes");
	});
});

describe("templates use the Astryx theme", () => {
	test("the button and wordmark carry the resolved accent", async () => {
		const { sent, deliver } = recording();
		await sendWelcomeEmail(welcomeJob, deliver);

		const html = await render(sent[0]?.react);

		expect(html).toContain(emailTheme.color.accent);
		expect(html).toContain(emailTheme.color.background);
		expect(html).not.toContain("var(--");
		expect(html).not.toContain("light-dark(");
	});
});

describe("processEmailJob", () => {
	test("sends the welcome email", async () => {
		const { sent, deliver } = recording();

		await processEmailJob(welcomeJob, deliver);

		expect(sent).toHaveLength(1);
	});

	/** BullMQ only retries what throws. */
	test("throws when delivery is unavailable, so the job retries", async () => {
		const { deliver } = recording({ ok: false, code: "unavailable" });

		await expect(processEmailJob(welcomeJob, deliver)).rejects.toThrow(
			/Welcome email not delivered/,
		);
	});

	/** A rejection fails the same way every time; retrying only repeats it. */
	test("does not throw when Resend rejects the message", async () => {
		const { deliver } = recording({ ok: false, code: "rejected" });

		await expect(processEmailJob(welcomeJob, deliver)).resolves.toBeUndefined();
	});

	test("rejects an unknown job type at runtime", async () => {
		const { sent, deliver } = recording();

		await expect(
			processEmailJob({ type: "nope" } as never, deliver),
		).rejects.toThrow(/Unknown email job type/);
		expect(sent).toHaveLength(0);
	});
});
