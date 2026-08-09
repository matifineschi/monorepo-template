import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createEmailQueue } from "@repo/queues";

import type { EmailSender } from "../../src/workers/email.worker";
import { startEmailWorker } from "../../src/workers/email.worker";

/**
 * Producer -> Redis -> consumer, which is the entire point of this app.
 * The email provider is injected rather than mocked at module scope: it's typed,
 * per-test, and there is no process-wide registry to fight over.
 */
const RUN = Date.now().toString(36);

const queue = createEmailQueue();
const sent: Parameters<EmailSender>[0][] = [];

const worker = startEmailWorker({
	concurrency: 1,
	send: async (message) => {
		sent.push(message);
	},
});

/** Drain anything an interrupted earlier run left behind. */
beforeAll(async () => {
	await queue.obliterate({ force: true });
});

afterAll(async () => {
	await worker.close();
	await queue.obliterate({ force: true });
	await queue.close();
});

describe("email worker", () => {
	test("processes an enqueued job", async () => {
		const job = await queue.add("send-welcome-email", {
			type: "send-welcome-email",
			userId: `user-${RUN}`,
			email: `worker-${RUN}@example.test`,
			name: "Ada Lovelace",
		});

		await waitForJob(job.id as string);

		expect(sent).toHaveLength(1);
		expect(sent[0]?.to).toBe(`worker-${RUN}@example.test`);
		expect(sent[0]?.body).toContain("Ada Lovelace");
	});
});

/** Waits for *this* job, so a stray job from another suite can't resolve it. */
function waitForJob(jobId: string, timeoutMs = 5000): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			worker.off("completed", onCompleted);
			reject(new Error(`job ${jobId} did not complete within ${timeoutMs}ms`));
		}, timeoutMs);

		function onCompleted(completed: { id?: string }) {
			if (completed.id !== jobId) return;
			clearTimeout(timer);
			worker.off("completed", onCompleted);
			resolve();
		}

		worker.on("completed", onCompleted);
	});
}
