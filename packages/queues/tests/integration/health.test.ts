import { afterAll, describe, expect, test } from "bun:test";

import { closeRedisProbe, pingRedis } from "../../src/health";

/**
 * Regression test for a bug the API's container smoke test found: the probe
 * connection is created with `lazyConnect`, so it starts in ioredis's `wait`
 * status, and issuing a command there with the offline queue disabled rejects
 * instead of waiting. The result was that the very first `/ready` call against
 * a freshly started container always failed — long enough to fail a deploy on
 * a platform with a low readiness threshold, and invisible in any test that
 * pinged twice.
 *
 * So the assertion that matters is the FIRST call, before anything else has
 * warmed the connection.
 */
afterAll(async () => {
	await closeRedisProbe();
});

describe("pingRedis", () => {
	test("succeeds on the very first call, with no warm-up", async () => {
		expect(await pingRedis()).toBeUndefined();
	});

	test("succeeds again on a reused connection", async () => {
		expect(await pingRedis()).toBeUndefined();
	});

	test("still succeeds after the probe has been closed", async () => {
		await closeRedisProbe();
		expect(await pingRedis()).toBeUndefined();
	});
});
