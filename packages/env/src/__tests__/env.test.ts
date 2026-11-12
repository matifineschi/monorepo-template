import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { booleanFlag, shouldSkipEnvValidation } from "../index";

/**
 * This package has no bunfig preload on purpose: a preload that pinned
 * SKIP_ENV_VALIDATION would make every assertion below tautological.
 */
describe("shouldSkipEnvValidation", () => {
	let savedSkip: string | undefined;
	let savedLifecycle: string | undefined;

	beforeEach(() => {
		savedSkip = process.env.SKIP_ENV_VALIDATION;
		savedLifecycle = process.env.npm_lifecycle_event;
		process.env.SKIP_ENV_VALIDATION = undefined;
		process.env.npm_lifecycle_event = undefined;
	});

	afterEach(() => {
		restore("SKIP_ENV_VALIDATION", savedSkip);
		restore("npm_lifecycle_event", savedLifecycle);
	});

	test("skips when SKIP_ENV_VALIDATION is exactly 1", () => {
		process.env.SKIP_ENV_VALIDATION = "1";
		expect(shouldSkipEnvValidation()).toBe(true);
	});

	test("does not skip for other truthy-looking values", () => {
		process.env.SKIP_ENV_VALIDATION = "true";
		expect(shouldSkipEnvValidation()).toBe(false);
	});

	test("skips for an allowlisted lifecycle event", () => {
		process.env.npm_lifecycle_event = "typecheck";
		expect(shouldSkipEnvValidation()).toBe(true);
	});

	test("does not skip for a non-allowlisted lifecycle event", () => {
		process.env.npm_lifecycle_event = "dev";
		expect(shouldSkipEnvValidation()).toBe(false);
	});

	/**
	 * Deliberately absent from the allowlist. The db:* scripts need a real
	 * DATABASE_URL, and a named validation error beats a connection error.
	 * `test` is excluded because skipping returns runtimeEnv raw — zod defaults
	 * and transforms never run, so tests would exercise types production never
	 * sees (see any workspace's test-setup.ts).
	 */
	test.each(["db:generate", "db:migrate", "db:push", "build", "test"])(
		"does not skip during %s",
		(event) => {
			process.env.npm_lifecycle_event = event;
			expect(shouldSkipEnvValidation()).toBe(false);
		},
	);

	test("does not skip with neither signal set", () => {
		expect(shouldSkipEnvValidation()).toBe(false);
	});
});

describe("booleanFlag", () => {
	/**
	 * The whole reason this helper exists: z.coerce.boolean() treats the string
	 * "false" as true, which silently inverts every opt-out flag.
	 */
	test('parses "false" as false, unlike z.coerce.boolean()', () => {
		expect(booleanFlag(true).parse("false")).toBe(false);
	});

	test.each([
		["true", true],
		["1", true],
		["TRUE", true],
		["  true  ", true],
		["false", false],
		["0", false],
		["FALSE ", false],
	] as const)("parses %p as %p", (input, expected) => {
		expect(booleanFlag(!expected).parse(input)).toBe(expected);
	});

	test("falls back to the default when unset", () => {
		expect(booleanFlag(true).parse(undefined)).toBe(true);
		expect(booleanFlag(false).parse(undefined)).toBe(false);
	});

	test("falls back to the default on unrecognized input", () => {
		expect(booleanFlag(true).parse("yes")).toBe(true);
		expect(booleanFlag(false).parse("yes")).toBe(false);
	});

	test("defaults to false when no default is given", () => {
		expect(booleanFlag().parse(undefined)).toBe(false);
	});
});

function restore(name: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = value;
	}
}
