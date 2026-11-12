import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { FeatureGrid } from "./_components/feature-grid";
import styles from "./home.module.css";


export default function HomePage() {
	return (
		<VStack gap={0}>
			{/* Hero */}
			<VStack paddingInline={6} paddingBlock={10} gap={6} hAlign="center">
				<VStack maxWidth={820} gap={6} hAlign="center">
					<Badge label="Open source monorepo template · v1.0" />

					<Heading level={1} type="display-1" justify="center">
						Ship your next{" "}
						<span className={styles.gradientText}>SaaS faster</span>
					</Heading>

					<Text type="large" color="secondary" justify="center">
						A production-ready monorepo with Next.js, Better Auth, Drizzle ORM,
						and a full component library. Skip the boilerplate and focus on what
						makes your product unique.
					</Text>

					<HStack gap={3} align="center" justify="center" wrap="wrap">
						<Button
							label="Get started for free"
							variant="primary"
							size="lg"
							href="/sign-up"
						/>
						<Button
							label="Explore features"
							variant="secondary"
							size="lg"
							href="#features"
						/>
					</HStack>

					<Text type="supporting" justify="center">
						No credit card required · Open source · MIT license
					</Text>
				</VStack>
			</VStack>

			{/* Features */}
			<VStack
				id="features"
				paddingInline={6}
				paddingBlock={10}
				gap={10}
				hAlign="center"
			>
				<VStack maxWidth={640} gap={4} hAlign="center">
					<Heading level={2} type="display-2" justify="center">
						Everything you need, nothing you don&apos;t
					</Heading>
					<Text type="body" color="secondary" justify="center">
						Carefully chosen technologies that work together seamlessly, so you
						can move fast without breaking things.
					</Text>
				</VStack>

				<FeatureGrid />
			</VStack>

			{/* Closing call to action */}
			<VStack paddingInline={6} paddingBlock={10} hAlign="center">
				<Card variant="purple" padding={10} width="100%" maxWidth={1152}>
					<VStack gap={4} hAlign="center">
						<Heading level={2} type="display-2" justify="center">
							Ready to build something great?
						</Heading>
						<Text type="body" color="secondary" justify="center">
							Clone the repo, configure your environment, and you&apos;re live
							in minutes.
						</Text>
						<HStack gap={3} align="center" justify="center" wrap="wrap">
							<Button
								label="Start building now"
								variant="primary"
								size="lg"
								href="/sign-up"
							/>
							<Button
								label="Sign in"
								variant="ghost"
								size="lg"
								href="/sign-in"
							/>
						</HStack>
					</VStack>
				</Card>
			</VStack>
		</VStack>
	);
}
