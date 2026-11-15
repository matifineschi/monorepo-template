import { Button } from "react-email";

import { emailTheme as t } from "../theme";

/**
 * Astryx `Button variant="primary" width="100%"`: accent fill, on-accent
 * label, element radius. A link styled as a button, because that is the only
 * button every email client renders.
 */
export function EmailButton({ href, label }: { href: string; label: string }) {
	return (
		<Button
			href={href}
			style={{
				...t.text.label,
				backgroundColor: t.color.accent,
				borderRadius: t.radius.element,
				boxSizing: "border-box",
				color: t.color.onAccent,
				display: "block",
				fontFamily: t.font.body,
				margin: `${t.space[2]} 0 ${t.space[6]}`,
				padding: `${t.space[3]} ${t.space[4]}`,
				textAlign: "center",
				textDecoration: "none",
				width: "100%",
			}}
		>
			{label}
		</Button>
	);
}
