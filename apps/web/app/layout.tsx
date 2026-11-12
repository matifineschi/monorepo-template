// globals.css must come first: it names the design system's cascade layers,
// and a stylesheet that loads before it would silently invert the cascade.
import "./globals.css";

import type { Metadata } from "next";

import { Providers } from "@repo/ui/providers";

import { clientEnv } from "@/env";

export const metadata: Metadata = {
	metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
	title: "Monorepo Template",
	description: "Full-stack TypeScript monorepo starter",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
