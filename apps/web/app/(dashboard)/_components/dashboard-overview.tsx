"use client";

// Client component on purpose: Astryx's `Icon` is client-side, and a lucide
// icon *component* cannot cross the server/client boundary as a prop. The
// page stays a server component and owns the session; this owns presentation.

import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import {
	ArrowUpRightIcon,
	BarChart3Icon,
	FolderIcon,
	UsersIcon,
	ZapIcon,
} from "lucide-react";

const stats = [
	{
		label: "Total Users",
		value: "—",
		icon: UsersIcon,
		description: "Active accounts",
	},
	{
		label: "Projects",
		value: "—",
		icon: FolderIcon,
		description: "Active projects",
	},
	{ label: "Events", value: "—", icon: ZapIcon, description: "This month" },
	{
		label: "Revenue",
		value: "—",
		icon: BarChart3Icon,
		description: "Monthly recurring",
	},
];

const quickActions = [
	{
		title: "Invite team members",
		description: "Add collaborators to your workspace",
		href: "/dashboard/settings",
		icon: UsersIcon,
	},
	{
		title: "Create a project",
		description: "Start organizing your work",
		href: "/dashboard/projects",
		icon: FolderIcon,
	},
	{
		title: "View analytics",
		description: "Track key metrics and trends",
		href: "/dashboard/analytics",
		icon: BarChart3Icon,
	},
];

export function DashboardOverview() {
	return (
		<VStack gap={8}>
			{/* Reflows 4 -> 2 -> 1 on its own; no breakpoint classes needed. */}
			<Grid columns={{ minWidth: 220, max: 4 }} gap={4}>
				{stats.map((stat) => (
					<Card key={stat.label} padding={5}>
						<HStack justify="between" align="start" gap={3}>
							<VStack gap={1}>
								<Text type="supporting">{stat.label}</Text>
								<Heading level={2} type="display-3">
									{stat.value}
								</Heading>
								<Text type="supporting">{stat.description}</Text>
							</VStack>
							<Icon icon={stat.icon} color="secondary" />
						</HStack>
					</Card>
				))}
			</Grid>

			<Grid columns={{ minWidth: 300, max: 3 }} gap={6}>
				<VStack gap={4}>
					<Heading level={2}>Quick actions</Heading>
					<VStack gap={2}>
						{quickActions.map((action) => (
							<ClickableCard
								key={action.title}
								label={action.title}
								href={action.href}
								padding={4}
							>
								<HStack gap={3} align="center">
									<Icon icon={action.icon} color="secondary" />
									<VStack gap={0.5}>
										<Text type="label">{action.title}</Text>
										<Text type="supporting">{action.description}</Text>
									</VStack>
									<Icon icon={ArrowUpRightIcon} color="tertiary" size="sm" />
								</HStack>
							</ClickableCard>
						))}
					</VStack>
				</VStack>

				<VStack gap={4}>
					<Heading level={2}>Recent activity</Heading>
					<Card padding={0}>
						<EmptyState
							title="No activity yet"
							description="Activity will appear here once you and your team start using the workspace."
							icon={<Icon icon={ZapIcon} color="secondary" size="lg" />}
						/>
					</Card>
				</VStack>
			</Grid>
		</VStack>
	);
}
