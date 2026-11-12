import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { createEmailQueue } from "../../src/queues";

/** Run-scoped so a leftover job from an interrupted run can't be mistaken for ours. */
const RUN = Date.now().toString(36);

const queue = createEmailQueue();

/** Clean in both hooks: an interrupted run leaves jobs the next must not inherit. */
beforeAll(async () => {
	await queue.obliterate({ force: true });
});

afterAll(async () => {
	await queue.obliterate({ force: true });
	await queue.close();
});

describe("email queue", () => {
	test("round-trips a job payload through real Redis", async () => {
		const payload = {
			type: "send-welcome-email",
			userId: `user-${RUN}`,
			email: `ada-${RUN}@example.test`,
			name: "Ada Lovelace",
		} as const;

		const added = await queue.add("send-welcome-email", payload);
		const read = await queue.getJob(added.id as string);

		expect(read?.data).toEqual(payload);
	});

	/**
	 * Retry policy is silently-wrong-forever config: nothing surfaces a bad
	 * backoff until production jobs start hammering a downed provider.
	 */
	test("applies the shared retry defaults", async () => {
		const added = await queue.add("send-welcome-email", {
			type: "send-welcome-email",
			userId: `user-${RUN}-defaults`,
			email: `defaults-${RUN}@example.test`,
			name: "Ada",
		});

		const read = await queue.getJob(added.id as string);

		expect(read?.opts.attempts).toBe(3);
		expect(read?.opts.backoff).toEqual({ type: "exponential", delay: 1000 });
	});

	/**
	 * Proves createRedisConnection() actually read REDIS_URL end to end.
	 * BullMQ 6 keeps the Redis client on the backend, not on Queue.
	 */
	test("reports a live connection", async () => {
		const info = await (await queue.getBackend().client).info();
		expect(info).toContain("redis_version");
	});
});
