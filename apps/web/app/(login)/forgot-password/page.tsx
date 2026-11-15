import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@repo/features/auth";

import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
	if (await getSession(await headers())) {
		redirect("/dashboard");
	}

	return <ForgotPasswordForm />;
}
