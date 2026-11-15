import { describe, expect, test } from "bun:test";

import { heartbeatUrl } from "../lib/heartbeat";
import { lockKey, pgEnv, withDatabase } from "../lib/postgres";
import { BASE_FLAGS, remoteEnv, remotesEnv } from "../lib/rclone";
import { createReservoir, isFilesFromSafe } from "../lib/sample";
import { main } from "../main";

describe("main", () => {
	test("exits 2 for an unknown job", async () => {
		expect(await main(["definitely-not-a-job"])).toBe(2);
	});

	test("exits 2 with no job", async () => {
		expect(await main([])).toBe(2);
	});
});

describe("rclone config", () => {
	const remote = {
		accessKeyId: "AKIA-EXAMPLE",
		endpoint: "https://example.r2.cloudflarestorage.com",
		forcePathStyle: true,
		region: "auto",
		secretAccessKey: "super-secret-value",
	};

	test("maps a remote onto rclone's env-var form", () => {
		expect(remoteEnv("src", remote)).toEqual({
			RCLONE_CONFIG_SRC_ACCESS_KEY_ID: "AKIA-EXAMPLE",
			RCLONE_CONFIG_SRC_ENDPOINT: "https://example.r2.cloudflarestorage.com",
			RCLONE_CONFIG_SRC_FORCE_PATH_STYLE: "true",
			RCLONE_CONFIG_SRC_PROVIDER: "Other",
			RCLONE_CONFIG_SRC_REGION: "auto",
			RCLONE_CONFIG_SRC_SECRET_ACCESS_KEY: "super-secret-value",
			RCLONE_CONFIG_SRC_TYPE: "s3",
		});
	});

	test("pins the config file away from disk", () => {
		expect(remotesEnv().RCLONE_CONFIG).toBe("/dev/null");
	});

	test("flags carry no credentials and skip the bucket check", () => {
		const flags = BASE_FLAGS.join(" ");
		expect(flags).not.toInclude(remote.secretAccessKey);
		expect(BASE_FLAGS).toContain("--s3-no-check-bucket");
	});
});

describe("pgEnv", () => {
	test("splits a URL into libpq variables, decoding the password", () => {
		expect(
			pgEnv("postgres://app:p%40ss@db.internal:6543/main?sslmode=require"),
		).toEqual({
			PGDATABASE: "main",
			PGHOST: "db.internal",
			PGPASSWORD: "p@ss",
			PGPORT: "6543",
			PGSSLMODE: "require",
			PGUSER: "app",
		});
	});

	test("defaults the port and omits an absent password", () => {
		const vars = pgEnv("postgres://app@db/main");
		expect(vars.PGPORT).toBe("5432");
		expect(vars.PGPASSWORD).toBeUndefined();
	});

	test("withDatabase swaps only the database", () => {
		expect(
			withDatabase("postgres://a:b@h:1/main?sslmode=require", "other"),
		).toBe("postgres://a:b@h:1/other?sslmode=require");
	});

	test("lock keys are stable and distinct per job", () => {
		expect(lockKey("postgres-backup")).toBe(lockKey("postgres-backup"));
		expect(lockKey("postgres-backup")).not.toBe(lockKey("bucket-backup"));
	});
});

describe("heartbeatUrl", () => {
	test("start / success / fail", () => {
		const base = "https://hc-ping.com/abc/";
		expect(heartbeatUrl(base, "start")).toBe("https://hc-ping.com/abc/start");
		expect(heartbeatUrl(base, "success")).toBe("https://hc-ping.com/abc");
		expect(heartbeatUrl(base, "fail")).toBe("https://hc-ping.com/abc/fail");
	});
});

describe("createReservoir", () => {
	test("keeps everything when the stream is smaller than the sample", () => {
		const reservoir = createReservoir<number>(5);
		for (const n of [1, 2, 3]) reservoir.offer(n);
		expect([...reservoir.sample].sort()).toEqual([1, 2, 3]);
		expect(reservoir.seen).toBe(3);
	});

	test("never exceeds the sample size", () => {
		const reservoir = createReservoir<number>(4);
		for (let n = 0; n < 1000; n += 1) reservoir.offer(n);
		expect(reservoir.sample).toHaveLength(4);
	});

	test("draws from the whole stream, not just the start", () => {
		let total = 0;
		for (let run = 0; run < 200; run += 1) {
			const reservoir = createReservoir<number>(1);
			for (let n = 0; n < 1000; n += 1) reservoir.offer(n);
			total += reservoir.sample[0] ?? 0;
		}
		const mean = total / 200;
		expect(mean).toBeGreaterThan(300);
		expect(mean).toBeLessThan(700);
	});
});

describe("isFilesFromSafe", () => {
	test("accepts the keys this template produces", () => {
		expect(isFilesFromSafe("uploads/user-1/0b5c.png")).toBe(true);
		expect(isFilesFromSafe("uploads/user 1/a file (1).pdf")).toBe(true);
		// Tabs are fine in --files-from; only line breaks split an entry.
		expect(isFilesFromSafe("uploads/u1/odd\tname.txt")).toBe(true);
	});

	/**
	 * S3 permits these. `--files-from` is newline delimited, so such an entry
	 * would split and the check would verify different objects than it reported.
	 */
	test("rejects a path containing a line break", () => {
		expect(isFilesFromSafe("uploads/u1/two\nlines.txt")).toBe(false);
		expect(isFilesFromSafe("uploads/u1/carriage\rreturn.txt")).toBe(false);
	});
});
