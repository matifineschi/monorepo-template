"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requestPasswordReset, resetPassword } from "@repo/features/auth";

import type {
	ForgotPasswordState,
	ResetPasswordState,
} from "./password-form-schema";
import {
	forgotPasswordSchema,
	resetPasswordSchema,
} from "./password-form-schema";

export async function requestPasswordResetAction(
	_: ForgotPasswordState,
	formData: FormData,
): Promise<ForgotPasswordState> {
	const raw = Object.fromEntries(formData.entries());
	const parsed = forgotPasswordSchema.safeParse(raw);

	if (!parsed.success) {
		return {
			email: typeof raw.email === "string" ? raw.email : "",
			entryErrors: z.flattenError(parsed.error).fieldErrors,
			error: "Please fix the errors and try again.",
		};
	}

	const result = await requestPasswordReset(parsed.data.email, await headers());
	if (!result.ok) {
		return {
			email: parsed.data.email,
			error: "We couldn't send the email. Please try again.",
		};
	}

	// The same answer for every address, registered or not.
	return { email: parsed.data.email, sent: true };
}

export async function resetPasswordAction(
	_: ResetPasswordState,
	formData: FormData,
): Promise<ResetPasswordState> {
	const parsed = resetPasswordSchema.safeParse(
		Object.fromEntries(formData.entries()),
	);

	if (!parsed.success) {
		return {
			entryErrors: z.flattenError(parsed.error).fieldErrors,
			error: "Please fix the errors and try again.",
		};
	}

	const result = await resetPassword(
		{ token: parsed.data.token, newPassword: parsed.data.password },
		await headers(),
	);

	if (!result.ok) {
		switch (result.code) {
			case "invalid-token":
				return { tokenInvalid: true };
			case "invalid-password":
				return {
					error: "Password must be between 8 and 100 characters.",
				};
			case "failed":
				return { error: "Something went wrong. Please try again." };
		}
	}

	// Every session was revoked with the old password, so sign in afresh.
	redirect("/sign-in?reset=success");
}
