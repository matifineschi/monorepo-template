import { describe, expect, test } from "bun:test";

import { emailSafe, emailTheme } from "../theme";

function leaves(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (value && typeof value === "object") {
		return Object.values(value).flatMap(leaves);
	}
	return [];
}

describe("emailTheme", () => {
	/**
	 * Email clients evaluate none of these. A token that resolves to one would
	 * render as an unstyled element in every inbox, silently.
	 */
	test("every value is concrete and email-safe", () => {
		for (const value of leaves(emailTheme)) {
			expect(value).not.toContain("var(");
			expect(value).not.toContain("light-dark(");
			expect(value).not.toMatch(/\d+rem\b/);
			expect(value).not.toMatch(/#[0-9a-f]{8}\b/i);
		}
	});
});

describe("emailSafe", () => {
	test("converts rem to px at a 16px root", () => {
		expect(emailSafe("0.75rem")).toBe("12px");
		expect(emailSafe("1rem 1.5rem")).toBe("16px 24px");
	});

	test("converts 8-digit hex to rgba", () => {
		expect(emailSafe("#00000014")).toBe("rgba(0, 0, 0, 0.078)");
	});

	test("leaves everything else alone", () => {
		expect(emailSafe("#1b1b1b")).toBe("#1b1b1b");
		expect(emailSafe("600")).toBe("600");
	});
});
