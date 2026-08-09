import { describe, expect, test } from "bun:test";

import { getNameParts } from "../operations/users";

/**
 * better-auth hands us whatever the sign-up form produced — `name` may be
 * absent, blank, or a single word. This function decides what every new user is
 * called, and each branch below is a case better-auth can actually produce.
 */
describe("getNameParts", () => {
	test("splits a full name", () => {
		expect(getNameParts({ name: "Ada Lovelace", email: null })).toEqual({
			firstName: "Ada",
			lastName: "Lovelace",
		});
	});

	test("keeps every trailing word as the last name", () => {
		expect(getNameParts({ name: "Ada King Lovelace", email: null })).toEqual({
			firstName: "Ada",
			lastName: "King Lovelace",
		});
	});

	test("pads a single-word name", () => {
		expect(getNameParts({ name: "Ada", email: null })).toEqual({
			firstName: "Ada",
			lastName: "User",
		});
	});

	test("falls back to the email local part when name is missing", () => {
		expect(getNameParts({ name: null, email: "ada@example.com" })).toEqual({
			firstName: "ada",
			lastName: "User",
		});
	});

	test("prefers a present name over the email", () => {
		expect(getNameParts({ name: "Ada", email: "grace@example.com" })).toEqual({
			firstName: "Ada",
			lastName: "User",
		});
	});

	test("treats a blank name as missing", () => {
		expect(getNameParts({ name: "   ", email: "ada@example.com" })).toEqual({
			firstName: "ada",
			lastName: "User",
		});
	});

	test("collapses irregular whitespace", () => {
		expect(getNameParts({ name: "  Ada   Lovelace  ", email: null })).toEqual({
			firstName: "Ada",
			lastName: "Lovelace",
		});
	});

	test("falls back entirely when both are missing", () => {
		expect(getNameParts({ name: null, email: null })).toEqual({
			firstName: "User",
			lastName: "User",
		});
	});
});
