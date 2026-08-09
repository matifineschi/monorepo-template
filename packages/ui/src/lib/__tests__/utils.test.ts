import { describe, expect, test } from "bun:test";

import { cn } from "../utils";

/**
 * `cn` is the one piece of @repo/ui that is ours rather than vendored shadcn.
 * The point of it is tailwind-merge conflict resolution — without that it would
 * just be clsx, and every component's className override would silently lose.
 */
describe("cn", () => {
	test("last conflicting utility wins", () => {
		expect(cn("p-2", "p-4")).toBe("p-4");
	});

	test("resolves conflicts across the same axis only", () => {
		expect(cn("px-2", "py-4")).toBe("px-2 py-4");
	});

	test("drops falsy conditionals", () => {
		const isHidden = false;
		expect(cn("base", isHidden && "hidden", null, undefined, "")).toBe("base");
	});

	test("supports the object and array forms clsx accepts", () => {
		expect(cn("base", { active: true, disabled: false }, ["extra"])).toBe(
			"base active extra",
		);
	});

	test("a caller override beats the component default", () => {
		// The pattern every component uses: cn(defaults, props.className)
		expect(cn("rounded-md bg-red-500", "bg-blue-500")).toBe(
			"rounded-md bg-blue-500",
		);
	});

	test("returns an empty string for no meaningful input", () => {
		expect(cn()).toBe("");
	});
});
