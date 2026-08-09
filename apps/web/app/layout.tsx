import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { clientEnv } from "@/env";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});
const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

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
			<body className={`${geistSans.variable} ${geistMono.variable}`}>
				{children}
			</body>
		</html>
	);
}
