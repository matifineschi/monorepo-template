import { describe, expect, test } from "bun:test";

import { isOwnedBy, uploadKey, userPrefix } from "../keys";

/**
 * There is no files table, so the key prefix IS the ownership record. Every
 * assertion here is guarding a cross-tenant read or delete, not a formatting
 * preference.
 */

const USER = "3f1c2b4a-0000-4000-8000-000000000001";

describe("userPrefix", () => {
	test("ends with a slash", () => {
		// Without it, `uploads/user-1` is a prefix of `uploads/user-10/secret.png`
		// and a list call would cross tenants.
		expect(userPrefix("user-1")).toBe("uploads/user-1/");
	});

	test.each(["../evil", "a/b", "", "user 1", "user\0", ".."])(
		"refuses to build a prefix from %p",
		(userId) => {
			expect(() => userPrefix(userId)).toThrow();
		},
	);
});

describe("uploadKey", () => {
	test("always lands under the user's prefix", () => {
		expect(uploadKey(USER, "photo.png").startsWith(`uploads/${USER}/`)).toBe(
			true,
		);
	});

	test("never reuses the original filename", () => {
		expect(uploadKey(USER, "invoice.pdf")).not.toContain("invoice");
	});

	test("is collision-free across calls", () => {
		const keys = new Set(
			Array.from({ length: 50 }, () => uploadKey(USER, "a.png")),
		);
		expect(keys.size).toBe(50);
	});

	test.each([
		["photo.PNG", ".png"],
		["photo.png", ".png"],
		["archive.tar.gz", ".bin"],
		["report.pdf", ".pdf"],
		["noextension", ".bin"],
		["trailing.", ".bin"],
		["weird.exe", ".bin"],
		["query.png?x=1", ".bin"],
	] as const)("maps %p to extension %p", (filename, expected) => {
		expect(uploadKey(USER, filename).endsWith(expected)).toBe(true);
	});

	/** A traversal filename must not escape the prefix — it only ever donates an extension. */
	test.each([
		"../../etc/passwd",
		"../../../root/.ssh/id_rsa.png",
		"/absolute/path.png",
		"nested/dir/file.png",
		"null\0byte.png",
	])("contains %p safely", (filename) => {
		const key = uploadKey(USER, filename);
		expect(key.startsWith(`uploads/${USER}/`)).toBe(true);
		expect(key).not.toContain("..");
		expect(key).not.toContain("\0");
		// Exactly three segments: uploads / userId / object
		expect(key.split("/")).toHaveLength(3);
	});
});

describe("isOwnedBy", () => {
	test("accepts a key this module issued", () => {
		expect(isOwnedBy(uploadKey(USER, "a.png"), USER)).toBe(true);
	});

	test("rejects another user's key", () => {
		expect(isOwnedBy("uploads/other-user/a.png", USER)).toBe(false);
	});

	/** The bug the trailing slash in userPrefix exists to prevent. */
	test("rejects a prefix-collision key", () => {
		expect(isOwnedBy("uploads/user-10/secret.png", "user-1")).toBe(false);
	});

	test.each([
		["", "empty key"],
		["uploads/", "root only"],
		["/uploads/user/a.png", "leading slash"],
		["uploads/../other/a.png", "traversal"],
		["uploads/user\0/a.png", "null byte"],
		["some/other/place.png", "outside the upload root"],
	] as const)("rejects %p (%s)", (key) => {
		expect(isOwnedBy(key, USER)).toBe(false);
	});

	test("rejects a bare prefix with no object name", () => {
		expect(isOwnedBy(`uploads/${USER}/`, USER)).toBe(false);
	});

	test("rejects an unsafe user id outright", () => {
		expect(isOwnedBy("uploads/../a.png", "..")).toBe(false);
	});
});
