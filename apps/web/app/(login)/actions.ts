"use server";

import { auth } from "@repo/auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { $ZodFlattenedError } from "zod/v4/core";

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
	const basePath = input.redirect?.startsWith("/") ? input.redirect : "/dashboard";
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
	const value = cookiePair.slice(separatorIndex + 1);
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

async function forwardAuthCookies(response: Response): Promise<void> {
	const cookieStore = await cookies();

	for (const header of getSetCookieHeaders(response.headers)) {
		const parsedCookie = parseSetCookieHeader(header);
		if (!parsedCookie) {
			continue;
		}

		if (Object.keys(parsedCookie.options).length > 0) {
			cookieStore.set(parsedCookie.name, parsedCookie.value, parsedCookie.options);
			continue;
		}

		cookieStore.set(parsedCookie.name, parsedCookie.value);
	}
}

async function parseErrorMessage(
	response: Response,
	defaultMessage: string,
): Promise<string> {
	try {
		const body = (await response.json()) as
			| { error?: { message?: string }; message?: string }
			| undefined;
		return body?.error?.message ?? body?.message ?? defaultMessage;
	} catch {
		return defaultMessage;
	}
}

function getNameFromEmail(email: string): string {
	return email.split("@")[0] || "User";
}

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
	const response =
		mode === "signin"
			? await auth.api.signInEmail({
					asResponse: true,
					body: {
						email: data.email,
						password: data.password,
					},
					headers: requestHeaders,
				})
			: await auth.api.signUpEmail({
					asResponse: true,
					body: {
						email: data.email,
						name: getNameFromEmail(data.email),
						password: data.password,
					},
					headers: requestHeaders,
				});

	if (!response.ok) {
		return {
			email: data.email,
			error: await parseErrorMessage(
				response,
				mode === "signin"
					? "Unable to sign in. Please check your credentials."
					: "Unable to create your account. Please try again.",
			),
		};
	}

	await forwardAuthCookies(response);

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
