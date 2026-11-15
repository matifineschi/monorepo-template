import type { ReactNode } from "react";
import { Heading } from "react-email";

import { emailTheme as t } from "../theme";

/** Astryx `Heading level={1}`, at the heading-1 step of the type scale. */
export function EmailHeading({ children }: { children: ReactNode }) {
	return (
		<Heading
			as="h1"
			style={{
				...t.text.heading,
				color: t.color.text,
				fontFamily: t.font.heading,
				margin: `0 0 ${t.space[4]}`,
			}}
		>
			{children}
		</Heading>
	);
}
