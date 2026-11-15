import { afterEach, describe, expect, test } from "bun:test";

import { bucketBackup } from "../jobs/bucket-backup";
import { bucketBackupCheck } from "../jobs/bucket-backup-check";
import { installFakeBins } from "./fake-bin";

let fakes: Awaited<ReturnType<typeof installFakeBins>> | undefined;

afterEach(async () => {
	await fakes?.restore();
	fakes = undefined;
});

/** A fake rclone that exits `copyExit` from `copy`. */
function fakeCopy(copyExit: number): string {
	return `
for a in "$@"; do
	case "$a" in
		copy) exit ${copyExit} ;;
	esac
done
exit 0`;
}

describe("bucketBackup", () => {
	test("copies the source and writes nothing else", async () => {
		fakes = await installFakeBins({ rclone: fakeCopy(0) });

		const result = await bucketBackup();

		expect(result).toEqual({ complete: true });
		const calls = await fakes.calls();
		expect(calls.some((call) => call.includes(" copy "))).toBe(true);
		expect(calls.some((call) => call.includes(" copyto "))).toBe(false);
		expect(calls.some((call) => call.includes(" lsf "))).toBe(false);
	});

	/**
	 * rclone exits 10 when --max-duration is reached. The old job treated that as
	 * a failure, so a large first copy alerted every night.
	 */
	test("hitting the time budget is partial progress, not a failure", async () => {
		fakes = await installFakeBins({ rclone: fakeCopy(10) });

		const result = await bucketBackup();

		expect(result).toEqual({ complete: false });
	});

	test("any other copy error fails the job", async () => {
		fakes = await installFakeBins({ rclone: fakeCopy(5) });

		await expect(bucketBackup()).rejects.toThrow("Bucket copy failed");
	});
});

/** A fake rclone that lists two keys and exits `checkExit` from `check`. */
function fakeCheck(checkExit: number): string {
	return `
for a in "$@"; do
	case "$a" in
		lsf) printf 'uploads/a.txt\\nuploads/b.txt\\n'; exit 0 ;;
		check) exit ${checkExit} ;;
	esac
done
exit 0`;
}

describe("bucketBackupCheck", () => {
	test("samples the source listing and checks those objects", async () => {
		fakes = await installFakeBins({ rclone: fakeCheck(0) });

		const result = await bucketBackupCheck();

		expect(result).toEqual({ checked: 2, objects: 2 });
		const calls = await fakes.calls();
		const lsf = calls.findIndex((call) => call.includes(" lsf "));
		const check = calls.findIndex((call) => call.includes(" check "));
		expect(lsf).toBeGreaterThanOrEqual(0);
		expect(lsf).toBeLessThan(check);
		expect(
			calls.some(
				(call) =>
					call.includes(" --one-way ") &&
					call.includes(" --download ") &&
					call.includes(" --files-from "),
			),
		).toBe(true);
	});

	test("a content mismatch fails the job", async () => {
		fakes = await installFakeBins({ rclone: fakeCheck(1) });

		await expect(bucketBackupCheck()).rejects.toThrow(
			"Backup does not match the source",
		);
	});
});
