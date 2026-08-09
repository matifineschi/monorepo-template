import { describe, expect, test } from "bun:test";

import { QUEUE_NAMES } from "../jobs";

/**
 * Queue names are baked into Redis keys. Renaming one orphans every job already
 * enqueued under the old name — they are a wire format, not an internal label,
 * so they get pinned here.
 */
describe("QUEUE_NAMES", () => {
	test("matches the names jobs are already enqueued under", () => {
		expect(QUEUE_NAMES).toEqual({ email: "email", files: "files" });
	});

	test("has no duplicate values", () => {
		const values = Object.values(QUEUE_NAMES);
		expect(new Set(values).size).toBe(values.length);
	});
});
