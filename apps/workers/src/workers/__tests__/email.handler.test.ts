import { describe, expect, test } from "bun:test";

import type { EmailSender } from "../email.worker";
import { processEmailJob } from "../email.worker";

function recordingSender() {
	const sent: Parameters<EmailSender>[0][] = [];
	const send: EmailSender = async (message) => {
		sent.push(message);
	};
	return { sent, send };
}

describe("processEmailJob", () => {
	test("sends a welcome email to the job's address", async () => {
		const { sent, send } = recordingSender();

		await processEmailJob(
			{
				type: "send-welcome-email",
				userId: "user-1",
				email: "ada@example.test",
				name: "Ada",
			},
			send,
		);

		expect(sent).toHaveLength(1);
		expect(sent[0]?.to).toBe("ada@example.test");
		expect(sent[0]?.subject).toBe("Welcome!");
		expect(sent[0]?.body).toContain("Ada");
	});

	/**
	 * The `never` guard in the default branch is only a compile-time promise.
	 * A malformed job from an older producer still reaches it at runtime, and it
	 * must fail loudly rather than silently succeed.
	 */
	test("rejects an unknown job type at runtime", async () => {
		const { sent, send } = recordingSender();

		await expect(
			processEmailJob({ type: "nope" } as never, send),
		).rejects.toThrow(/Unknown email job type/);
		expect(sent).toHaveLength(0);
	});
});
