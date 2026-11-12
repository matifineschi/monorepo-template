import { describe, expect, test } from "bun:test";

import { err, ok, tryAsyncResult, tryResult, unwrap } from "../result";

describe("ok / err", () => {
	test("ok carries the value", () => {
		expect(ok({ id: "u1" })).toEqual({ ok: true, value: { id: "u1" } });
	});

	test("err carries only the code when there is no cause", () => {
		const result = err("email-taken");

		expect(result).toEqual({ ok: false, code: "email-taken" });
		expect("cause" in result).toBe(false);
	});

	test("err carries the cause when given one", () => {
		const cause = new Error("unique violation");
		expect(err("email-taken", cause)).toEqual({
			ok: false,
			code: "email-taken",
			cause,
		});
	});

	/** `const C extends string` is what keeps the code a literal, not `string`. */
	test("narrows the code to a literal type", () => {
		const result = err("email-taken");
		if (!result.ok) {
			const code: "email-taken" = result.code;
			expect(code).toBe("email-taken");
		}
	});
});

describe("tryResult", () => {
	test("returns the value on success", () => {
		expect(tryResult(() => JSON.parse('{"a":1}'))).toEqual({
			ok: true,
			value: { a: 1 },
		});
	});

	test("captures a throw as a normalized Error", () => {
		const result = tryResult(() => JSON.parse("{not json"));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBeInstanceOf(Error);
	});

	test("normalizes a thrown string", () => {
		const result = tryResult(() => {
			// biome-ignore lint/style/useThrowOnlyError: asserting that a thrown non-Error is normalized requires throwing one
			throw "a bare string";
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toBe("a bare string");
	});
});

describe("tryAsyncResult", () => {
	test("returns the awaited value on success", async () => {
		expect(await tryAsyncResult(async () => 42)).toEqual({
			ok: true,
			value: 42,
		});
	});

	test("captures a rejection", async () => {
		const result = await tryAsyncResult(async () => {
			throw new Error("async boom");
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toBe("async boom");
	});

	test("captures a synchronous throw from the callback", async () => {
		const result = await tryAsyncResult(() => {
			throw new Error("sync boom inside async wrapper");
		});

		expect(result.ok).toBe(false);
	});

	/**
	 * The hazard this guards: a rejection must not escape as an unhandled
	 * rejection while the caller is handed `{ ok: true }`.
	 */
	test("does not leak an unhandled rejection", async () => {
		let unhandled: unknown;
		const onUnhandled = (reason: unknown) => {
			unhandled = reason;
		};
		process.on("unhandledRejection", onUnhandled);

		await tryAsyncResult(() => Promise.reject(new Error("rejected")));
		await new Promise((resolve) => setTimeout(resolve, 10));

		process.off("unhandledRejection", onUnhandled);
		expect(unhandled).toBeUndefined();
	});
});

describe("unwrap", () => {
	test("returns the value of a successful result", () => {
		expect(unwrap({ ok: true, value: "fine" })).toBe("fine");
	});

	test("rethrows the error of a failed result", () => {
		const error = new Error("nope");
		expect(() => unwrap({ ok: false, error })).toThrow(error);
	});
});
