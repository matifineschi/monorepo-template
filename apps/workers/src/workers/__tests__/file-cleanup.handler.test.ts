import { describe, expect, test } from "bun:test";

import type { ObjectDeleter } from "../file-cleanup.worker";
import { processFileCleanupJob } from "../file-cleanup.worker";

describe("processFileCleanupJob", () => {
	test("deletes the object named in the job", async () => {
		const deleted: string[] = [];
		const remove: ObjectDeleter = async (key) => {
			deleted.push(key);
		};

		await processFileCleanupJob(
			{ type: "delete-file", key: "uploads/user-1/a.png" },
			remove,
		);

		expect(deleted).toEqual(["uploads/user-1/a.png"]);
	});

	/**
	 * BullMQ retries. If a delete threw because the object was already gone, one
	 * transient failure would become a permanently failed job — so the handler
	 * must tolerate an already-absent object.
	 */
	test("succeeds when the object is already gone", async () => {
		await expect(
			processFileCleanupJob(
				{ type: "delete-file", key: "uploads/user-1/missing.png" },
				async () => {
					/* deleteObject swallows NoSuchKey */
				},
			),
		).resolves.toBeUndefined();
	});

	test("propagates a real storage failure so BullMQ can retry", async () => {
		await expect(
			processFileCleanupJob(
				{ type: "delete-file", key: "uploads/user-1/a.png" },
				async () => {
					throw new Error("connection reset");
				},
			),
		).rejects.toThrow("connection reset");
	});

	test("rejects an unknown job type at runtime", async () => {
		const deleted: string[] = [];

		await expect(
			processFileCleanupJob({ type: "nope" } as never, async (key) => {
				deleted.push(key);
			}),
		).rejects.toThrow(/Unknown file job type/);
		expect(deleted).toHaveLength(0);
	});
});
