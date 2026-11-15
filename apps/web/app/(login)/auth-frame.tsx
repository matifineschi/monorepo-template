import { VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import type { ReactNode } from "react";

import { BrandMark } from "../_components/brand-mark";

/**
 * The centred column every signed-out page shares: brand mark, page title,
 * then the page's own content. The welcome and reset emails mirror this frame
 * (see `@repo/features/email`), so a link from an inbox lands somewhere that
 * looks like where it came from.
 */
export function AuthFrame({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
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
						{title}
					</Heading>
				</VStack>
				{children}
			</VStack>
		</VStack>
	);
}
