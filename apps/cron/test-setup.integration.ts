import { afterAll } from "bun:test";

import { provisionTestDatabase } from "@repo/db/testing/database";
import { provisionTestBucket } from "@repo/storage/testing/bucket";

/**
 * Preloaded by `test:integration` only. The backup round trip needs a real
 * database to dump and a real bucket to put it in, both from the test stack in
 * docker-compose.test.yml.
 *
 * `envVar` points the bucket at BACKUP_S3_BUCKET rather than STORAGE_BUCKET:
 * this service never touches the application's bucket.
 */
process.env.TEST_DATABASE_ADMIN_URL ??=
	"postgres://postgres:postgres@localhost:54322/postgres";
process.env.BACKUP_S3_ENDPOINT =
	process.env.TEST_STORAGE_ENDPOINT ?? "http://localhost:59002";
process.env.BACKUP_S3_ACCESS_KEY_ID ??= "minioadmin";
process.env.BACKUP_S3_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.BACKUP_S3_REGION ??= "auto";
process.env.BACKUP_S3_FORCE_PATH_STYLE ??= "true";

// The provisioner also needs the application's storage vars to build its client.
process.env.STORAGE_ENDPOINT = process.env.BACKUP_S3_ENDPOINT;
process.env.STORAGE_ACCESS_KEY_ID ??= "minioadmin";
process.env.STORAGE_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.STORAGE_REGION ??= "auto";
process.env.STORAGE_FORCE_PATH_STYLE ??= "true";

process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? "warn";

process.env.SOURCE_S3_ENDPOINT = process.env.BACKUP_S3_ENDPOINT;
process.env.SOURCE_S3_ACCESS_KEY_ID ??= "minioadmin";
process.env.SOURCE_S3_SECRET_ACCESS_KEY ??= "minioadmin";
process.env.SOURCE_S3_REGION ??= "auto";
process.env.SOURCE_S3_FORCE_PATH_STYLE ??= "true";

const database = await provisionTestDatabase({ label: "cron" });
const backupBucket = await provisionTestBucket({
	envVar: "BACKUP_S3_BUCKET",
	label: "cron-backup",
});
/**
 * A second bucket standing in for the application's. `STORAGE_BUCKET` points at
 * the same one so the suite can seed it through `@repo/storage`, which is how
 * the real application writes — seeding it with a raw client would not exercise
 * the same put path.
 */
const sourceBucket = await provisionTestBucket({
	envVar: "SOURCE_S3_BUCKET",
	label: "cron-source",
});
process.env.STORAGE_BUCKET = sourceBucket.name;

afterAll(async () => {
	await Promise.all([
		database.drop(),
		backupBucket.drop(),
		sourceBucket.drop(),
	]);
});
