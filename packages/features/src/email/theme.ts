import { resolveThemeTokens } from "@astryxdesign/core/theme/tokens";

import { theme } from "@repo/ui/theme";
import { createError } from "@repo/utils/error";

/**
 * The app's Astryx theme, resolved into values an email client can render.
 *
 * Astryx components can't be used in email: they style through StyleX classes
 * and CSS custom properties with `light-dark()`, and email clients strip
 * `<style>` blocks and don't evaluate `var()`. So templates are built from
 * React Email primitives and styled *only* from this object, which Astryx's
 * own resolver fills from the same theme `@repo/ui` mounts. Swap the theme
 * there and every email follows; nothing here is a hand-picked value.
 *
 * Light mode on purpose: most clients render email light, and the ones that
 * auto-darken do it to light designs.
 */
const tokens = resolveThemeTokens(theme, { mode: "light" });

/** The root font size Astryx's rem tokens are authored against. */
const ROOT_FONT_SIZE_PX = 16;

/**
 * One token as an email-safe CSS value: rem becomes px (Outlook ignores rem)
 * and 8-digit hex becomes rgba() (several clients drop the alpha byte or the
 * whole declaration).
 */
export function emailSafe(value: string): string {
	return value
		.replace(
			/(-?\d*\.?\d+)rem\b/g,
			(_match, amount: string) =>
				`${Number.parseFloat(amount) * ROOT_FONT_SIZE_PX}px`,
		)
		.replace(/#([0-9a-f]{6})([0-9a-f]{2})\b/gi, (_match, rgb, alpha) => {
			const [r, g, b] = [0, 2, 4].map((i) =>
				Number.parseInt(rgb.slice(i, i + 2), 16),
			);
			const a = Math.round((Number.parseInt(alpha, 16) / 255) * 1000) / 1000;
			return `rgba(${r}, ${g}, ${b}, ${a})`;
		});
}

function token(name: string): string {
	const value = tokens[name];
	if (!value) {
		throw createError("Unknown Astryx token", { context: { name } });
	}
	return emailSafe(value);
}

/** An Astryx type-scale step (`--text-<step>-*`) as inline style fields. */
function textStyle(step: string) {
	return {
		fontSize: token(`--text-${step}-size`),
		fontWeight: token(`--text-${step}-weight`),
		lineHeight: token(`--text-${step}-leading`),
	};
}

export const emailTheme = {
	color: {
		background: token("--color-background-body"),
		card: token("--color-background-card"),
		border: token("--color-border"),
		text: token("--color-text-primary"),
		textSecondary: token("--color-text-secondary"),
		accent: token("--color-accent"),
		onAccent: token("--color-on-accent"),
	},
	font: {
		body: token("--font-family-body"),
		heading: token("--font-family-heading"),
	},
	text: {
		display: textStyle("display-3"),
		heading: textStyle("heading-1"),
		body: textStyle("body"),
		label: textStyle("label"),
		supporting: textStyle("supporting"),
	},
	space: {
		1: token("--spacing-1"),
		2: token("--spacing-2"),
		3: token("--spacing-3"),
		4: token("--spacing-4"),
		6: token("--spacing-6"),
		8: token("--spacing-8"),
	},
	radius: {
		element: token("--radius-element"),
		container: token("--radius-container"),
	},
	borderWidth: token("--border-width"),
} as const;

export const brand = {
	/** Matches the wordmark the web app renders next to `BrandMark`. */
	name: "Acme",
	/**
	 * Mirrors the sign-in column (`maxWidth={420}` in the web app's login),
	 * so an email reads like the card the user just saw.
	 */
	contentWidth: 420,
} as const;
