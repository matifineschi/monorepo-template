import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createFileQueue } from "@repo/queues";
import { deleteObject, listObjects, putObject } from "@repo/storage";

import { startFileCleanupWorker } from "../../src/workers/file-cleanup.worker";

/**
 * The whole async-cleanup path across both Redis and the bucket: put a real
 * object in MinIO, enqueue the job the API would enqueue, and assert the object
 * is actually gone. Uses the real deleteObject — a stub here would prove nothing.
 */
const RUN = Date.now().toString(36);
const PREFIX = `test-runs/${RUN}/`;

const queue = createFileQueue();
const worker = startFileCleanupWorker({ concurrency: 1 });

/**
 * The queue is shared with apps/api's integration suite, which enqueues a real
 * delete-file job and has no worker to drain it. Turbo runs those suites in
 * parallel, so this worker can pick up a foreign job at any moment — hence both
 * the beforeAll drain and the job-id matching in waitFor below.
 */
beforeAll(async () => {
	await queue.obliterate({ force: true });
});

afterAll(async () => {
	await worker.close();
	await queue.obliterate({ force: true });
	await queue.close();

	const leftovers = await listObjects(PREFIX);
	await Promise.all(leftovers.map((object) => deleteObject(object.key)));
});

describe("file cleanup worker", () => {
	test("removes the object named in the job", async () => {
		const key = `${PREFIX}doomed.txt`;
		await putObject(key, new TextEncoder().encode("delete me"), "text/plain");
		expect(await listObjects(key)).toHaveLength(1);

		await enqueueAndAwait(key);

		expect(await listObjects(key)).toEqual([]);
	});

	/** A retry must not fail the job just because the object is already gone. */
	test("completes for an object that never existed", async () => {
		await expect(
			enqueueAndAwait(`${PREFIX}never-existed.txt`),
		).resolves.toBeUndefined();
	});
});

/**
 * Waits for *this* job, not merely the next completion event — otherwise a job
 * enqueued by another suite resolves the wait and the assertion races.
 */
async function enqueueAndAwait(key: string, timeoutMs = 5000): Promise<void> {
	const job = await queue.add("delete-file", { type: "delete-file", key });

	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			worker.off("completed", onCompleted);
			reject(new Error(`job ${job.id} did not complete within ${timeoutMs}ms`));
		}, timeoutMs);

		function onCompleted(completed: { id?: string }) {
			if (completed.id !== job.id) return;
			clearTimeout(timer);
			worker.off("completed", onCompleted);
			resolve();
		}

		worker.on("completed", onCompleted);
	});
}
