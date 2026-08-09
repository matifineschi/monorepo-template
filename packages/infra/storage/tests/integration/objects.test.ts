import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
	createUploadUrl,
	deleteObject,
	getObject,
	listObjects,
	putObject,
} from "../../src/objects";

/**
 * Runs against the real MinIO in docker-compose. Mocking the S3 SDK here would
 * defeat the purpose: the failures this catches — wrong path-style addressing,
 * a bad region, an unsigned header — only exist against a real endpoint.
 *
 * Run-scoped prefix + afterAll cleanup is not optional. Nothing else ever
 * truncates a bucket, so a leaked object stays forever.
 */
const RUN = Date.now().toString(36);
const PREFIX = `test-runs/${RUN}/`;
const key = (name: string) => `${PREFIX}${name}`;

async function purge() {
	const existing = await listObjects(PREFIX);
	await Promise.all(existing.map((object) => deleteObject(object.key)));
}

beforeAll(purge);
afterAll(purge);

describe("put / get", () => {
	test("round-trips bytes and content type", async () => {
		const body = new TextEncoder().encode("hello storage");

		await putObject(key("round-trip.txt"), body, "text/plain");
		const result = await getObject(key("round-trip.txt"));

		expect(new TextDecoder().decode(result.body)).toBe("hello storage");
		expect(result.contentType).toBe("text/plain");
	});

	test("round-trips binary content unchanged", async () => {
		const body = new Uint8Array([0, 1, 2, 250, 251, 255]);

		await putObject(key("bytes.bin"), body, "application/octet-stream");
		const result = await getObject(key("bytes.bin"));

		expect(Array.from(result.body)).toEqual(Array.from(body));
	});
});

describe("listObjects", () => {
	test("returns only keys under the given prefix", async () => {
		await putObject(key("listed/a.txt"), new Uint8Array([1]), "text/plain");
		await putObject(key("listed/b.txt"), new Uint8Array([2]), "text/plain");
		await putObject(key("elsewhere.txt"), new Uint8Array([3]), "text/plain");

		const listed = await listObjects(`${PREFIX}listed/`);
		const keys = listed.map((object) => object.key).sort();

		expect(keys).toEqual([key("listed/a.txt"), key("listed/b.txt")]);
		expect(listed[0]?.size).toBe(1);
		expect(listed[0]?.lastModified).toBeInstanceOf(Date);
	});

	test("returns an empty array for a prefix with nothing under it", async () => {
		expect(await listObjects(`${PREFIX}nothing-here/`)).toEqual([]);
	});
});

describe("deleteObject", () => {
	test("removes the object", async () => {
		await putObject(key("doomed.txt"), new Uint8Array([1]), "text/plain");
		await deleteObject(key("doomed.txt"));

		expect(await listObjects(key("doomed.txt"))).toEqual([]);
	});

	/** BullMQ retries; a second delete must not fail the job. */
	test("is a no-op on a second call", async () => {
		await putObject(key("twice.txt"), new Uint8Array([1]), "text/plain");
		await deleteObject(key("twice.txt"));

		expect(await deleteObject(key("twice.txt"))).toBeUndefined();
	});

	test("is a no-op for a key that never existed", async () => {
		expect(await deleteObject(key("never-existed.txt"))).toBeUndefined();
	});
});

/**
 * The single most valuable assertion in this package: a presigned URL that a
 * plain fetch actually accepts proves endpoint, region, credentials, signing
 * and path-style addressing are all correct together.
 */
describe("createUploadUrl", () => {
	test("produces a URL a plain PUT is accepted at", async () => {
		const target = key("presigned.txt");
		const { uploadUrl, expiresAt } = await createUploadUrl({
			key: target,
			contentType: "text/plain",
		});

		expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

		const upload = await fetch(uploadUrl, {
			method: "PUT",
			headers: { "content-type": "text/plain" },
			body: "uploaded via presigned url",
		});
		expect(upload.ok).toBe(true);

		const stored = await getObject(target);
		expect(new TextDecoder().decode(stored.body)).toBe(
			"uploaded via presigned url",
		);
	});

	test("honours a custom expiry", async () => {
		const { expiresAt } = await createUploadUrl({
			key: key("short.txt"),
			contentType: "text/plain",
			expiresInSeconds: 60,
		});

		const secondsOut = (expiresAt.getTime() - Date.now()) / 1000;
		expect(secondsOut).toBeGreaterThan(50);
		expect(secondsOut).toBeLessThanOrEqual(60);
	});
});
