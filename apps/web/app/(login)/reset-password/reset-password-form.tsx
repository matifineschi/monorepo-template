"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Stack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useActionState, useState } from "react";

import { AuthFrame } from "../auth-frame";
import { resetPasswordAction } from "../password-actions";
import type { ResetPasswordState } from "../password-form-schema";
import { ResetPasswordField } from "../password-form-schema";

/**
 * `token` is null when better-auth redirected here with `?error=INVALID_TOKEN`
 * (expired or already used), or when the page was opened without a link.
 */
export function ResetPasswordForm({ token }: { token: string | null }) {
	const [state, formAction, pending] = useActionState<
		ResetPasswordState,
		FormData
	>(resetPasswordAction, {});

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const passwordError = state.entryErrors?.password?.[0];
	const confirmError = state.entryErrors?.confirmPassword?.[0];

	if (!token || state.tokenInvalid) {
		return (
			<AuthFrame title="Link expired">
				<Card padding={6}>
					<VStack gap={5}>
						<Banner
							status="error"
							title="This reset link is invalid or has expired"
							description="Reset links work once and expire after an hour. Request a new one to continue."
							collapsible={false}
							container="card"
						/>
						<Button
							variant="primary"
							label="Request a new link"
							href="/forgot-password"
							width="100%"
						/>
					</VStack>
				</Card>
			</AuthFrame>
		);
	}

	return (
		<AuthFrame title="Choose a new password">
			<Card padding={6}>
				<form action={formAction}>
					<VStack gap={5}>
						<input
							type="hidden"
							name={ResetPasswordField.token}
							value={token}
						/>

						<TextInput
							label="New password"
							htmlName={ResetPasswordField.password}
							type="password"
							autoComplete="new-password"
							placeholder="At least 8 characters"
							value={password}
							onChange={setPassword}
							isRequired
							width="100%"
							status={
								passwordError
									? { type: "error", message: passwordError }
									: undefined
							}
						/>

						<TextInput
							label="Confirm new password"
							htmlName={ResetPasswordField.confirmPassword}
							type="password"
							autoComplete="new-password"
							placeholder="Repeat the new password"
							value={confirmPassword}
							onChange={setConfirmPassword}
							isRequired
							width="100%"
							status={
								confirmError
									? { type: "error", message: confirmError }
									: undefined
							}
						/>

						{state.error ? (
							<Banner
								status="error"
								title={state.error}
								collapsible={false}
								container="card"
							/>
						) : null}

						<Button
							type="submit"
							variant="primary"
							label="Update password"
							isLoading={pending}
							width="100%"
						/>
					</VStack>
				</form>
			</Card>
		</AuthFrame>
	);
}
