import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@repo/features/auth";

import { Login } from "../login";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
	const session = await getSession(await headers());

	if (session) {
		redirect("/dashboard");
	}

	return (
		<Suspense>
			<Login mode="signin" />
		</Suspense>
	);
}
