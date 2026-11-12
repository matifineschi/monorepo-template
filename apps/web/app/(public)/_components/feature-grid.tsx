"use client";

// Client component on purpose: Astryx's `Icon` is client-side, and a lucide
// icon *component* cannot be passed across the server/client boundary as a
// prop. Keeping the icon references in this module avoids that entirely.

import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import {
	ActivityIcon,
	BlocksIcon,
	BoxIcon,
	MonitorIcon,
	ShieldCheckIcon,
	WrenchIcon,
} from "lucide-react";

const features = [
	{
		icon: ShieldCheckIcon,
		title: "Authentication built-in",
		description:
			"Secure email and password auth powered by Better Auth with PostgreSQL session storage. Ready to extend with OAuth, 2FA, and more.",
	},
	{
		icon: MonitorIcon,
		title: "Full-stack TypeScript",
		description:
			"End-to-end type safety from database schema to UI components. Drizzle ORM, Next.js App Router, and a shared UI package — all in one repo.",
	},
	{
		icon: BoxIcon,
		title: "Turborepo monorepo",
		description:
			"Blazing-fast builds with intelligent caching. Share code across apps and packages with zero friction using Bun workspaces.",
	},
	{
		icon: BlocksIcon,
		title: "Component library",
		description:
			"150+ accessible components from Astryx, Meta's open source design system. Themeable, dark-mode ready, and driven by design tokens from day one.",
	},
	{
		icon: ActivityIcon,
		title: "Production-ready patterns",
		description:
			"Route protection via middleware, server-side session checks, form validation with Zod, and server actions — best practices baked in.",
	},
	{
		icon: WrenchIcon,
		title: "Developer experience",
		description:
			"Biome for lightning-fast linting and formatting, Docker Compose for the local database, and Drizzle Studio for visual schema inspection.",
	},
];

export function FeatureGrid() {
	return (
		<Grid
			columns={{ minWidth: 300, max: 3 }}
			gap={4}
			width="100%"
			maxWidth={1152}
		>
			{features.map((feature) => (
				<Card key={feature.title} padding={6}>
					<VStack gap={3}>
						<Icon icon={feature.icon} color="accent" size="lg" />
						<Heading level={3}>{feature.title}</Heading>
						<Text type="supporting">{feature.description}</Text>
					</VStack>
				</Card>
			))}
		</Grid>
	);
}
