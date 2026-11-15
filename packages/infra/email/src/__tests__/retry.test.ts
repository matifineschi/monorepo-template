import { describe, expect, test } from "bun:test";

import { isRetryable, retryDelayMs } from "../retry";

describe("isRetryable", () => {
	test("retries network failures, rate limits and server errors", () => {
		expect(isRetryable(null)).toBe(true);
		expect(isRetryable(429)).toBe(true);
		expect(isRetryable(500)).toBe(true);
		expect(isRetryable(503)).toBe(true);
	});

	/** A bad sender or a restricted key fails identically on every attempt. */
	test("never retries any other 4xx", () => {
		for (const status of [400, 401, 403, 404, 409, 422]) {
			expect(isRetryable(status)).toBe(false);
		}
	});
});

describe("retryDelayMs", () => {
	test("honours retry-after over its own backoff", () => {
		expect(retryDelayMs(0, "2", () => 0)).toBe(2000);
	});

	test("caps a huge retry-after so a job is not parked for minutes", () => {
		expect(retryDelayMs(0, "3600", () => 0)).toBe(5000);
	});

	test("backs off exponentially with jitter when there is no header", () => {
		expect(retryDelayMs(0, null, () => 1)).toBe(250);
		expect(retryDelayMs(2, null, () => 1)).toBe(1000);
		expect(retryDelayMs(2, "not-a-number", () => 0.5)).toBe(500);
	});
});
