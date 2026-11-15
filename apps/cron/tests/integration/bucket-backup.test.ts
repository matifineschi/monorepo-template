import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { putObject } from "@repo/storage";

import { env } from "../../src/env";
import { bucketBackup } from "../../src/jobs/bucket-backup";
import { bucketBackupCheck } from "../../src/jobs/bucket-backup-check";
import {
	backupPath,
	listBackupObjects,
	rcloneOrThrow,
} from "../../src/lib/rclone";

/** Round trip against real object storage. Needs rclone on PATH. */
const rcloneAvailable = Bun.which("rclone") !== null;

if (!rcloneAvailable) {
	// A skip exits 0. On a laptop that is a missing binary; in CI it would be a
	// green run of the only test that copies a real bucket.
	const message = "bucket backup integration tests need rclone on PATH";
	if (process.env.CI) throw new Error(message);
	console.warn(`\n  SKIPPING ${message}.\n`);
}

const SEEDED = [
	"uploads/user-1/first.txt",
	"uploads/user-1/second.txt",
	"uploads/user-2/third.txt",
];

describe.skipIf(!rcloneAvailable)("bucket backup round trip", () => {
	beforeAll(async () => {
		for (const [index, key] of SEEDED.entries()) {
			await putObject(
				key,
				new TextEncoder().encode(`contents of object ${index}`),
				"text/plain",
			);
		}
	});

	test("copies every object", async () => {
		const result = await bucketBackup();

		expect(result.complete).toBe(true);
		const stored = await listBackupObjects(env.BUCKET_BACKUP_PREFIX);
		expect(stored.map((object) => object.path).sort()).toEqual(
			SEEDED.map((key) => `${env.BUCKET_BACKUP_PREFIX}/${key}`).sort(),
		);
	});

	test("the check compares the copies byte for byte", async () => {
		const { checked, objects } = await bucketBackupCheck();
		expect(objects).toBe(SEEDED.length);
		expect(checked).toBe(SEEDED.length);
	});

	test("is incremental on a second run", async () => {
		expect((await bucketBackup()).complete).toBe(true);
		expect((await bucketBackupCheck()).checked).toBe(SEEDED.length);
	});

	/** The assertion the check exists for. */
	test("the check fails when a copy no longer matches the source", async () => {
		const directory = await mkdtemp(join(tmpdir(), "tamper-"));
		try {
			const file = join(directory, "tampered.txt");
			await writeFile(file, "tampered contents of a different length entirely");
			await rcloneOrThrow([
				"copyto",
				file,
				backupPath(`${env.BUCKET_BACKUP_PREFIX}/${SEEDED[0]}`),
			]);
		} finally {
			await rm(directory, { force: true, recursive: true });
		}

		await expect(bucketBackupCheck()).rejects.toThrow(
			"Backup does not match the source",
		);
	});

	test("a later backup run repairs the tampered copy", async () => {
		await bucketBackup();
		expect((await bucketBackupCheck()).checked).toBe(SEEDED.length);
	});
});
