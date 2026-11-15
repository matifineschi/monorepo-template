"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useActionState, useState } from "react";

import { AuthFrame } from "../auth-frame";
import { requestPasswordResetAction } from "../password-actions";
import type { ForgotPasswordState } from "../password-form-schema";
import { ForgotPasswordField } from "../password-form-schema";

export function ForgotPasswordForm() {
	const [state, formAction, pending] = useActionState<
		ForgotPasswordState,
		FormData
	>(requestPasswordResetAction, {});

	// TextInput is controlled; `htmlName` is what puts it in the FormData.
	const [email, setEmail] = useState(state.email ?? "");
	const emailError = state.entryErrors?.email?.[0];

	return (
		<AuthFrame title="Reset your password">
			<Card padding={6}>
				{state.sent ? (
					<Banner
						status="success"
						title="Check your email"
						description={`If an account exists for ${state.email}, we've sent a link to reset its password. The link expires in an hour.`}
						container="card"
					/>
				) : (
					<form action={formAction}>
						<VStack gap={5}>
							<Text type="supporting">
								Enter the email you signed up with and we&apos;ll send you a
								link to choose a new password.
							</Text>

							<TextInput
								label="Email"
								htmlName={ForgotPasswordField.email}
								type="email"
								autoComplete="email"
								placeholder="Enter your email"
								value={email}
								onChange={setEmail}
								isRequired
								width="100%"
								status={
									emailError
										? { type: "error", message: emailError }
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
								label="Send reset link"
								isLoading={pending}
								width="100%"
							/>
						</VStack>
					</form>
				)}
			</Card>

			<VStack hAlign="center">
				<Link href="/sign-in" type="supporting" isStandalone>
					Back to sign in
				</Link>
			</VStack>
		</AuthFrame>
	);
}
