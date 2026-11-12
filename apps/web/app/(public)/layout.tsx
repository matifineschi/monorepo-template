import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Link } from "@astryxdesign/core/Link";
import { NavIcon } from "@astryxdesign/core/NavIcon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";

import { BrandMark } from "../_components/brand-mark";

const NAV_ITEMS = [
	{ label: "Features", href: "#features" },
	{ label: "Pricing", href: "#pricing" },
	{ label: "Docs", href: "#docs" },
	{ label: "Blog", href: "#blog" },
];

const FOOTER_LINKS = ["Privacy", "Terms", "Contact"];

export default function PublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AppShell
			height="auto"
			variant="section"
			topNav={
				<TopNav
					label="Main navigation"
					heading={
						<TopNavHeading
							heading="Acme"
							logo={<NavIcon icon={<BrandMark />} />}
						/>
					}
					startContent={NAV_ITEMS.map((item) => (
						<TopNavItem key={item.href} label={item.label} href={item.href} />
					))}
					endContent={
						<HStack gap={2} align="center">
							<Button
								label="Sign in"
								variant="ghost"
								size="sm"
								href="/sign-in"
							/>
							<Button
								label="Get started"
								variant="primary"
								size="sm"
								href="/sign-up"
							/>
						</HStack>
					}
				/>
			}
		>
			<VStack gap={0}>
				{children}

				<Divider />
				<VStack paddingInline={6} paddingBlock={8} gap={4}>
					<HStack gap={4} align="center" justify="between" wrap="wrap">
						<HStack gap={2} align="center">
							<BrandMark />
							<Text type="label">Acme</Text>
						</HStack>
						<Text type="supporting">
							© {new Date().getFullYear()} Acme Inc. All rights reserved.
						</Text>
						<HStack gap={4} align="center" wrap="wrap">
							{FOOTER_LINKS.map((item) => (
								<Link key={item} href="#">
									<Text type="supporting">{item}</Text>
								</Link>
							))}
						</HStack>
					</HStack>
				</VStack>
			</VStack>
		</AppShell>
	);
}
