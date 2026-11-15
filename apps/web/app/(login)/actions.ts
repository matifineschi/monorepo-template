"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { $ZodFlattenedError } from "zod/v4/core";

import type { SignInCode, SignUpCode } from "@repo/features/auth";
import { signInWithEmail, signUpWithEmail } from "@repo/features/auth";
import { displayNameFromEmail } from "@repo/features/users";

const loginSchema = z.object({
	email: z.string().trim().email("Enter a valid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(100, "Password must be 100 characters or fewer"),
	redirect: z.string().optional(),
	priceId: z.string().optional(),
	inviteId: z.string().optional(),
});

type LoginFormInput = z.output<typeof loginSchema>;
type FieldErrors = $ZodFlattenedError<LoginFormInput>["fieldErrors"];

export type LoginActionState = {
	entryErrors?: FieldErrors;
	error?: string;
	email?: string;
};

type CookieOptions = {
	domain?: string;
	expires?: Date;
	httpOnly?: boolean;
	maxAge?: number;
	path?: string;
	priority?: "high" | "low" | "medium";
	sameSite?: "lax" | "none" | "strict";
	secure?: boolean;
};

function getPostAuthRedirect(input: LoginFormInput): string {
	const basePath = input.redirect?.startsWith("/")
		? input.redirect
		: "/dashboard";
	const url = new URL(basePath, "http://localhost");

	if (input.priceId) {
		url.searchParams.set("priceId", input.priceId);
	}

	if (input.inviteId) {
		url.searchParams.set("inviteId", input.inviteId);
	}

	return `${url.pathname}${url.search}`;
}

function parseSetCookieHeader(header: string): {
	name: string;
	value: string;
	options: CookieOptions;
} | null {
	const segments = header.split(";").map((segment) => segment.trim());
	const [cookiePair, ...attributes] = segments;

	if (!cookiePair) {
		return null;
	}

	const separatorIndex = cookiePair.indexOf("=");
	if (separatorIndex <= 0) {
		return null;
	}

	const name = cookiePair.slice(0, separatorIndex);
	const rawValue = cookiePair.slice(separatorIndex + 1);
	// Set-Cookie header values are URL-encoded; Next.js cookies().set re-encodes,
	// so decode here to avoid double-encoding (which breaks signature validation).
	let value = rawValue;
	try {
		value = decodeURIComponent(rawValue);
	} catch {
		value = rawValue;
	}
	const options: CookieOptions = {};

	for (const attribute of attributes) {
		const [rawKey, ...rawValueParts] = attribute.split("=");
		const key = rawKey?.toLowerCase();
		const rawValue = rawValueParts.join("=");

		switch (key) {
			case "domain":
				options.domain = rawValue;
				break;
			case "expires":
				if (rawValue) {
					options.expires = new Date(rawValue);
				}
				break;
			case "httponly":
				options.httpOnly = true;
				break;
			case "max-age": {
				const parsedMaxAge = Number.parseInt(rawValue, 10);
				if (!Number.isNaN(parsedMaxAge)) {
					options.maxAge = parsedMaxAge;
				}
				break;
			}
			case "path":
				options.path = rawValue;
				break;
			case "secure":
				options.secure = true;
				break;
			case "samesite": {
				const normalized = rawValue.toLowerCase();
				if (
					normalized === "lax" ||
					normalized === "none" ||
					normalized === "strict"
				) {
					options.sameSite = normalized;
				}
				break;
			}
			case "priority": {
				const normalized = rawValue.toLowerCase();
				if (
					normalized === "low" ||
					normalized === "medium" ||
					normalized === "high"
				) {
					options.priority = normalized;
				}
				break;
			}
			default:
				break;
		}
	}

	return { name, options, value };
}

function getSetCookieHeaders(responseHeaders: Headers): string[] {
	const headersWithGetSetCookie = responseHeaders as Headers & {
		getSetCookie?: () => string[];
	};

	if (typeof headersWithGetSetCookie.getSetCookie === "function") {
		return headersWithGetSetCookie.getSetCookie();
	}

	const fallbackSetCookie = responseHeaders.get("set-cookie");
	return fallbackSetCookie ? [fallbackSetCookie] : [];
}

/**
 * The session cookie better-auth minted is in the feature's response headers;
 * a server action has to copy it onto Next's own response explicitly.
 */
async function forwardAuthCookies(responseHeaders: Headers): Promise<void> {
	const cookieStore = await cookies();

	for (const header of getSetCookieHeaders(responseHeaders)) {
		const parsedCookie = parseSetCookieHeader(header);
		if (!parsedCookie) {
			continue;
		}

		if (Object.keys(parsedCookie.options).length > 0) {
			cookieStore.set(
				parsedCookie.name,
				parsedCookie.value,
				parsedCookie.options,
			);
			continue;
		}

		cookieStore.set(parsedCookie.name, parsedCookie.value);
	}
}

const FAILURE_MESSAGES: Record<SignInCode | SignUpCode, string> = {
	"invalid-credentials": "Incorrect email or password.",
	"email-taken": "An account with this email already exists. Sign in instead.",
	"invalid-password": "Password must be between 8 and 100 characters.",
	failed: "Something went wrong. Please try again.",
};

async function authenticateWithEmailPassword(
	mode: "signin" | "signup",
	formData: FormData,
): Promise<LoginActionState> {
	const rawFormData = Object.fromEntries(formData.entries());
	const parsedForm = loginSchema.safeParse(rawFormData);

	if (!parsedForm.success) {
		return {
			email: typeof rawFormData.email === "string" ? rawFormData.email : "",
			entryErrors: z.flattenError(parsedForm.error).fieldErrors,
			error: "Please fix the errors and try again.",
		};
	}

	const requestHeaders = await headers();
	const { data } = parsedForm;
	const credentials = { email: data.email, password: data.password };
	const result =
		mode === "signin"
			? await signInWithEmail(credentials, requestHeaders)
			: await signUpWithEmail(
					{ ...credentials, name: displayNameFromEmail(data.email) },
					requestHeaders,
				);

	if (!result.ok) {
		return { email: data.email, error: FAILURE_MESSAGES[result.code] };
	}

	await forwardAuthCookies(result.value.headers);

	redirect(getPostAuthRedirect(data));
}

export async function signIn(
	_: LoginActionState,
	formData: FormData,
): Promise<LoginActionState> {
	return authenticateWithEmailPassword("signin", formData);
}

export async function signUp(
	_: LoginActionState,
	formData: FormData,
): Promise<LoginActionState> {
	return authenticateWithEmailPassword("signup", formData);
}
