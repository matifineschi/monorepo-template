import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
	deleteAuthUserById,
	getAuthUserByEmail,
} from "@repo/db/operations/user-auth";
import { deleteUserById } from "@repo/db/operations/users";
import { deleteObject, listObjects } from "@repo/storage";

import { app } from "../../src/index";
import { closeQueues, fileQueue } from "../../src/lib/queues";

/**
 * The full upload path end to end: sign up, presign, PUT the real bytes to
 * MinIO, list, delete. Requires Postgres, Redis and MinIO.
 *
 * Bucket objects are not cleaned up by anything else, so afterAll must remove
 * every key both users created or the bucket grows on every run.
 */
const RUN = Date.now().toString(36);
const PASSWORD = "correct-horse-battery-staple";
const OWNER_EMAIL = `files-owner-${RUN}@example.test`;
const OTHER_EMAIL = `files-other-${RUN}@example.test`;

type Session = { cookie: string; userId: string };

let owner: Session;
let other: Session;

async function signUp(email: string): Promise<Session> {
	const response = await app.request("/api/auth/sign-up/email", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ email, password: PASSWORD, name: "Test User" }),
	});
	if (response.status !== 200) {
		throw new Error(`sign-up failed for ${email}: ${response.status}`);
	}

	const authUser = await getAuthUserByEmail(email);

	return {
		cookie: response.headers.get("set-cookie") as string,
		userId: authUser?.id as string,
	};
}

async function removeUser(email: string) {
	const authUser = await getAuthUserByEmail(email);
	if (!authUser) return;

	// FK order: public.users before user_auth.users (ON DELETE RESTRICT).
	await deleteUserById(authUser.id);
	await deleteAuthUserById(authUser.id);
}

beforeAll(async () => {
	await Promise.all([removeUser(OWNER_EMAIL), removeUser(OTHER_EMAIL)]);
	owner = await signUp(OWNER_EMAIL);
	other = await signUp(OTHER_EMAIL);
});

afterAll(async () => {
	for (const session of [owner, other]) {
		if (!session?.userId) continue;
		const objects = await listObjects(`uploads/${session.userId}/`);
		await Promise.all(objects.map((object) => deleteObject(object.key)));
	}
	await Promise.all([removeUser(OWNER_EMAIL), removeUser(OTHER_EMAIL)]);

	// This suite enqueues a real delete-file job and runs no worker, so the job
	// would otherwise linger in Redis and be picked up by the workers suite.
	await fileQueue().obliterate({ force: true });
	await closeQueues();
});

function requestUploadUrl(session: Session, filename: string) {
	return app.request("/files/upload-url", {
		method: "POST",
		headers: { "content-type": "application/json", cookie: session.cookie },
		body: JSON.stringify({
			filename,
			contentType: "text/plain",
			sizeBytes: 32,
		}),
	});
}

describe("upload flow", () => {
	test("presigns, accepts a real PUT, and lists the object", async () => {
		const response = await requestUploadUrl(owner, "notes.txt");
		expect(response.status).toBe(200);

		const { key, uploadUrl } = (await response.json()) as {
			key: string;
			uploadUrl: string;
		};

		// The key is derived server-side and scoped to the session user.
		expect(key.startsWith(`uploads/${owner.userId}/`)).toBe(true);
		expect(key).not.toContain("notes");

		const upload = await fetch(uploadUrl, {
			method: "PUT",
			headers: { "content-type": "text/plain" },
			body: "uploaded through the api",
		});
		expect(upload.ok).toBe(true);

		const listed = await app.request("/files", {
			headers: { cookie: owner.cookie },
		});
		expect(listed.status).toBe(200);

		const body = (await listed.json()) as { files: { key: string }[] };
		expect(body.files.map((file) => file.key)).toContain(key);
	});

	/**
	 * With no files table, prefix scoping is the entire isolation mechanism —
	 * this is the assertion that proves it holds against a real bucket.
	 */
	test("does not leak another user's objects", async () => {
		const response = await requestUploadUrl(other, "secret.txt");
		const { key, uploadUrl } = (await response.json()) as {
			key: string;
			uploadUrl: string;
		};
		await fetch(uploadUrl, {
			method: "PUT",
			headers: { "content-type": "text/plain" },
			body: "not yours",
		});

		const listed = await app.request("/files", {
			headers: { cookie: owner.cookie },
		});
		const body = (await listed.json()) as { files: { key: string }[] };

		expect(body.files.map((file) => file.key)).not.toContain(key);
	});

	test("403s a delete of another user's key", async () => {
		const response = await app.request(
			`/files?key=uploads/${other.userId}/whatever.txt`,
			{ method: "DELETE", headers: { cookie: owner.cookie } },
		);

		expect(response.status).toBe(403);
	});

	test("accepts a delete of the caller's own key", async () => {
		const presigned = await requestUploadUrl(owner, "doomed.txt");
		const { key, uploadUrl } = (await presigned.json()) as {
			key: string;
			uploadUrl: string;
		};
		await fetch(uploadUrl, {
			method: "PUT",
			headers: { "content-type": "text/plain" },
			body: "delete me",
		});

		const response = await app.request(
			`/files?key=${encodeURIComponent(key)}`,
			{
				method: "DELETE",
				headers: { cookie: owner.cookie },
			},
		);

		// 202: the object is removed asynchronously by apps/workers.
		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({
			key,
			status: "deletion-queued",
		});
	});
});
