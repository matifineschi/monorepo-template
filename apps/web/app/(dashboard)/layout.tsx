import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@repo/features/auth";

import { DashboardShell } from "./_components/dashboard-shell";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession(await headers());

	if (!session) {
		redirect("/sign-in");
	}

	return <DashboardShell user={session.user}>{children}</DashboardShell>;
}
