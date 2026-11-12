"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";

import { BrandMark } from "../_components/brand-mark";
import type { LoginActionState } from "./actions";
import { signIn, signUp } from "./actions";

export function Login({ mode = "signin" }: { mode?: "signin" | "signup" }) {
	const searchParams = useSearchParams();
	const redirect = searchParams.get("redirect");
	const priceId = searchParams.get("priceId");
	const inviteId = searchParams.get("inviteId");
	const [state, formAction, pending] = useActionState<
		LoginActionState,
		FormData
	>(mode === "signin" ? signIn : signUp, { error: "" });

	// TextInput is controlled, so the values live here. `htmlName` is what puts
	// them in the FormData the server action reads -- not `name`.
	const [email, setEmail] = useState(state.email ?? "");
	const [password, setPassword] = useState("");

	const isSignIn = mode === "signin";
	const alternateHref = `${isSignIn ? "/sign-up" : "/sign-in"}${
		redirect ? `?redirect=${redirect}` : ""
	}${priceId ? `&priceId=${priceId}` : ""}${
		inviteId ? `&inviteId=${inviteId}` : ""
	}`;

	return (
		<VStack
			minHeight="100dvh"
			vAlign="center"
			hAlign="center"
			padding={6}
			gap={6}
		>
			<VStack width="100%" maxWidth={420} gap={6}>
				<VStack hAlign="center" gap={3}>
					<Text type="display-3" color="accent">
						<BrandMark />
					</Text>
					<Heading level={1} type="display-3" justify="center">
						{isSignIn ? "Sign in to your account" : "Create your account"}
					</Heading>
				</VStack>

				<Card padding={6}>
					<form action={formAction}>
						<VStack gap={5}>
							<input type="hidden" name="redirect" value={redirect || ""} />
							<input type="hidden" name="priceId" value={priceId || ""} />
							<input type="hidden" name="inviteId" value={inviteId || ""} />

							<TextInput
								label="Email"
								htmlName="email"
								type="email"
								autoComplete="email"
								placeholder="Enter your email"
								value={email}
								onChange={setEmail}
								isRequired
								width="100%"
								status={
									state?.entryErrors?.email?.[0]
										? { type: "error", message: state.entryErrors.email[0] }
										: undefined
								}
							/>

							<TextInput
								label="Password"
								htmlName="password"
								type="password"
								autoComplete={isSignIn ? "current-password" : "new-password"}
								placeholder="Enter your password"
								value={password}
								onChange={setPassword}
								isRequired
								width="100%"
								status={
									state?.entryErrors?.password?.[0]
										? { type: "error", message: state.entryErrors.password[0] }
										: undefined
								}
							/>

							{state?.error ? (
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
								label={isSignIn ? "Sign in" : "Sign up"}
								isLoading={pending}
								width="100%"
							/>
						</VStack>
					</form>
				</Card>

				<VStack gap={4} hAlign="center">
					<Divider />
					<Text type="supporting">
						{isSignIn ? "New to our platform?" : "Already have an account?"}
					</Text>
					<Button
						label={
							isSignIn ? "Create an account" : "Sign in to existing account"
						}
						variant="secondary"
						href={alternateHref}
						width="100%"
					/>
				</VStack>
			</VStack>
		</VStack>
	);
}
