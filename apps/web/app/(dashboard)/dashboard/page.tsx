import { VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { DashboardOverview } from "../_components/dashboard-overview";

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

function getFirstName(name: string): string {
	return name.split(" ")[0] ?? name;
}

export default async function DashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const greeting = getGreeting();
	const firstName = getFirstName(session?.user.name ?? "there");

	return (
		<VStack gap={8}>
			<VStack gap={1}>
				<Heading level={1} type="display-3">
					{greeting}, {firstName}
				</Heading>
				<Text type="supporting">
					Here&apos;s what&apos;s happening in your workspace today.
				</Text>
			</VStack>

			<DashboardOverview />
		</VStack>
	);
}
