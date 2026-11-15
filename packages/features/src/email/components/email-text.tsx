import type { ReactNode } from "react";
import { Text } from "react-email";

import { emailTheme as t } from "../theme";

/** Astryx `Text` with its `body` and `supporting` types. */
export function EmailText({
	type = "body",
	children,
}: {
	type?: "body" | "supporting";
	children: ReactNode;
}) {
	return (
		<Text
			style={{
				...t.text[type],
				color: type === "body" ? t.color.text : t.color.textSecondary,
				margin: `0 0 ${t.space[4]}`,
			}}
		>
			{children}
		</Text>
	);
}
