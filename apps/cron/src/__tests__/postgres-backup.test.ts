import { afterEach, describe, expect, test } from "bun:test";

import { postgresBackup, postgresBackupKey } from "../jobs/postgres-backup";
import { ARG_AFTER_FILE, installFakeBins } from "./fake-bin";

let fakes: Awaited<ReturnType<typeof installFakeBins>> | undefined;

afterEach(async () => {
	await fakes?.restore();
	fakes = undefined;
});

describe("postgresBackupKey", () => {
	test("is dated and sorts chronologically", () => {
		expect(postgresBackupKey(new Date("2026-11-15T03:00:00.000Z"), "pg")).toBe(
			"pg/2026/11/15/2026-11-15T03-00-00-000Z.dump",
		);
	});
});

describe("postgresBackup", () => {
	/**
	 * The bug the old streaming implementation had: pg_dump dies halfway, its
	 * stdout closes normally, and the truncated dump is uploaded as a success.
	 */
	test("a pg_dump that fails mid-dump uploads nothing", async () => {
		fakes = await installFakeBins({
			pg_dump: `${ARG_AFTER_FILE}; head -c 50000 /dev/zero > "$out"; exit 1`,
			pg_restore: "exit 0",
			rclone: "exit 0",
		});

		await expect(postgresBackup()).rejects.toThrow("Process exited non-zero");

		const calls = await fakes.calls();
		expect(calls.some((call) => call.startsWith("rclone"))).toBe(false);
	});

	test("an archive pg_restore cannot read uploads nothing", async () => {
		fakes = await installFakeBins({
			pg_dump: `${ARG_AFTER_FILE}; head -c 50000 /dev/zero > "$out"; exit 0`,
			pg_restore: "exit 1",
			rclone: "exit 0",
		});

		await expect(postgresBackup()).rejects.toThrow();
		expect((await fakes.calls()).some((c) => c.startsWith("rclone"))).toBe(
			false,
		);
	});

	test("an implausibly small dump uploads nothing", async () => {
		fakes = await installFakeBins({
			pg_dump: `${ARG_AFTER_FILE}; head -c 10 /dev/zero > "$out"; exit 0`,
			pg_restore: "exit 0",
			rclone: "exit 0",
		});

		await expect(postgresBackup()).rejects.toThrow("Dump is implausibly small");
		expect((await fakes.calls()).some((c) => c.startsWith("rclone"))).toBe(
			false,
		);
	});

	test("a good dump is uploaded, with no credentials in any argv", async () => {
		fakes = await installFakeBins({
			pg_dump: `${ARG_AFTER_FILE}; head -c 50000 /dev/zero > "$out"; exit 0`,
			pg_restore: "exit 0",
			rclone: "exit 0",
		});

		const { key, size } = await postgresBackup();
		expect(size).toBe(50000);

		const calls = await fakes.calls();
		expect(calls.find((c) => c.startsWith("rclone"))).toInclude(`copyto`);
		expect(calls.find((c) => c.startsWith("rclone"))).toInclude(key);
		// test-setup.ts's DATABASE_URL password and S3 secret
		for (const call of calls) {
			expect(call).not.toInclude("postgres:postgres@");
			expect(call).not.toInclude("minioadmin");
		}
	});
});
