import { z } from "zod";
import type { $ZodFlattenedError } from "zod/v4/core";

/** Kept in step with the sign-up rule in `./actions.ts` and better-auth's limits. */
const password = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.max(100, "Password must be 100 characters or fewer");

export const forgotPasswordSchema = z.object({
	email: z.string().trim().email("Enter a valid email address"),
});

export const ForgotPasswordField = forgotPasswordSchema.keyof().enum;

export type ForgotPasswordState = {
	email?: string;
	entryErrors?: $ZodFlattenedError<
		z.input<typeof forgotPasswordSchema>
	>["fieldErrors"];
	error?: string;
	/** Set after any valid submit, whether or not the address has an account. */
	sent?: boolean;
};

const resetPasswordFields = z.object({
	token: z.string().min(1),
	password,
	confirmPassword: z.string(),
});

/** Exported from the object, before `.refine` wraps it and hides `keyof`. */
export const ResetPasswordField = resetPasswordFields.keyof().enum;

export const resetPasswordSchema = resetPasswordFields.refine(
	(value) => value.password === value.confirmPassword,
	{ message: "Passwords don't match", path: ["confirmPassword"] },
);

export type ResetPasswordState = {
	entryErrors?: $ZodFlattenedError<
		z.input<typeof resetPasswordSchema>
	>["fieldErrors"];
	error?: string;
	/** The link itself is dead: a new one has to be requested. */
	tokenInvalid?: boolean;
};
