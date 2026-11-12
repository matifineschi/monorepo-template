import { describe, expect, test } from "bun:test";

import { createError } from "@repo/utils/error";

import { serializeError } from "../serializers";

describe("serializeError", () => {
	test("keeps type, message and stack", () => {
		const serialized = serializeError(new TypeError("bad type"));

		expect(serialized.type).toBe("TypeError");
		expect(serialized.message).toBe("bad type");
		expect(serialized.stack).toContain("bad type");
	});

	/** The reason this exists rather than using pino's default serializer. */
	test("preserves createError context", () => {
		const serialized = serializeError(
			createError("Upload is not durable", {
				context: { key: "uploads/u1/a" },
			}),
		);

		expect(serialized.context).toEqual({ key: "uploads/u1/a" });
	});

	test("flattens the whole cause chain", () => {
		const serialized = serializeError(
			createError("Job failed", {
				cause: createError("Presign failed", {
					cause: new Error("ECONNREFUSED"),
				}),
			}),
		);

		expect(serialized.message).toBe("Job failed");
		expect(serialized.causes).toEqual([
			{ type: "Error", message: "Presign failed" },
			{ type: "Error", message: "ECONNREFUSED" },
		]);
	});

	test("omits causes and context when there are none", () => {
		const serialized = serializeError(new Error("plain"));

		expect(serialized.causes).toBeUndefined();
		expect(serialized.context).toBeUndefined();
	});

	test("handles a thrown non-error", () => {
		expect(serializeError("a string")).toMatchObject({
			type: "Error",
			message: "a string",
		});
	});

	test("handles undefined", () => {
		expect(serializeError(undefined)).toEqual({
			type: "Unknown",
			message: "Unknown error",
			stack: undefined,
		});
	});
});
