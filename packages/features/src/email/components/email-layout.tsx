import type { ReactNode } from "react";
import {
	Body,
	Container,
	Head,
	Html,
	Preview,
	Section,
	Text,
} from "react-email";

import { brand, emailTheme as t } from "../theme";

/**
 * The frame every email shares, mirroring the web app's sign-in page: the
 * body background, the accent wordmark above, and the content in an Astryx
 * card (card background, hairline border, container radius).
 */
export function EmailLayout({
	preview,
	children,
}: {
	/** The inbox preview line. */
	preview: string;
	children: ReactNode;
}) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Body
				style={{
					backgroundColor: t.color.background,
					color: t.color.text,
					fontFamily: t.font.body,
					margin: 0,
					padding: `${t.space[8]} ${t.space[4]}`,
				}}
			>
				<Container style={{ maxWidth: brand.contentWidth }}>
					<Text
						style={{
							...t.text.display,
							color: t.color.accent,
							fontFamily: t.font.heading,
							margin: `0 0 ${t.space[6]}`,
							textAlign: "center",
						}}
					>
						{brand.name}
					</Text>
					<Section
						style={{
							backgroundColor: t.color.card,
							border: `${t.borderWidth} solid ${t.color.border}`,
							borderRadius: t.radius.container,
							padding: t.space[6],
						}}
					>
						{children}
					</Section>
					<Text
						style={{
							...t.text.supporting,
							color: t.color.textSecondary,
							margin: `${t.space[6]} 0 0`,
							textAlign: "center",
						}}
					>
						You received this email because of your {brand.name} account.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}
