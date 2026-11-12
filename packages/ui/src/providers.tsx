"use client";

import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import Link from "next/link";

/**
 * Mounts the design system at the app root.
 *
 * `LinkProvider` is what lets every link-bearing component take a plain `href`
 * and render it through `next/link`, so app code never reaches for an `asChild`
 * escape. `Theme` defaults to `mode="system"`, which is where dark mode comes
 * from -- there is no separate theme provider.
 */
export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<Theme theme={neutralTheme}>
			<LinkProvider component={Link}>{children}</LinkProvider>
		</Theme>
	);
}
