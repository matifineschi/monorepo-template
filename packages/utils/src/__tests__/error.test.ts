import { describe, expect, test } from "bun:test";

import { createError, ensureError, errorChain, errorContext } from "../error";

describe("createError", () => {
	test("produces a real Error with the given message", () => {
		const error = createError("Upload is not durable");

		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe("Upload is not durable");
		expect(error.cause).toBeUndefined();
		expect(error.context).toBeUndefined();
	});

	test("attaches structured context", () => {
		const error = createError("Upload is not durable", {
			context: { bucket: "app-uploads", key: "uploads/u1/a.png" },
		});

		expect(error.context).toEqual({
			bucket: "app-uploads",
			key: "uploads/u1/a.png",
		});
	});

	test("normalizes a non-Error cause", () => {
		const error = createError("Presign failed", { cause: "boom" });

		expect(error.cause).toBeInstanceOf(Error);
		expect((error.cause as Error).message).toBe("boom");
	});

	/** The point of captureStackTrace: the trace starts at the caller. */
	test("omits its own frame from the stack", () => {
		expect(createError("Something broke").stack).not.toContain(
			"at createError",
		);
	});
});

describe("ensureError", () => {
	test("passes an Error through unchanged", () => {
		const original = new Error("original");
		expect(ensureError(original)).toBe(original);
	});

	test("wraps a string as the message", () => {
		expect(ensureError("just a string").message).toBe("just a string");
	});

	test.each([
		["null", null],
		["undefined", undefined],
	])("turns %s into a named Error", (_label, value) => {
		expect(ensureError(value).message).toBe("Unknown error");
	});

	test("keeps a thrown object as the cause", () => {
		const thrown = { code: 500 };
		const error = ensureError(thrown);

		expect(error.message).toBe("Unknown error");
		expect(error.cause).toBe(thrown);
	});
});

describe("errorContext", () => {
	test("reads context off an AppError", () => {
		expect(errorContext(createError("x", { context: { a: 1 } }))).toEqual({
			a: 1,
		});
	});

	test("returns undefined for a plain Error or a non-error", () => {
		expect(errorContext(new Error("plain"))).toBeUndefined();
		expect(errorContext("not an error")).toBeUndefined();
	});
});

describe("errorChain", () => {
	test("walks causes outermost first", () => {
		const root = new Error("root");
		const middle = createError("middle", { cause: root });
		const outer = createError("outer", { cause: middle });

		expect(errorChain(outer).map((error) => error.message)).toEqual([
			"outer",
			"middle",
			"root",
		]);
	});

	/**
	 * Nothing prevents a cyclic cause chain, and walking one without this guard
	 * hangs the process rather than failing a test.
	 */
	test("terminates on a cyclic chain", () => {
		const a = new Error("a");
		const b = new Error("b");
		a.cause = b;
		b.cause = a;

		expect(errorChain(a).map((error) => error.message)).toEqual(["a", "b"]);
	});

	test("honours maxDepth", () => {
		let error = new Error("depth-0");
		for (let depth = 1; depth < 20; depth += 1) {
			error = createError(`depth-${depth}`, { cause: error });
		}

		expect(errorChain(error, 3)).toHaveLength(3);
	});
});
