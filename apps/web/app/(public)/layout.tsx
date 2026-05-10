import Link from "next/link";
import { Button } from "@repo/ui/components/button";

export default function PublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-svh flex flex-col bg-background">
			<header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
					{/* Logo */}
					<Link href="/" className="flex items-center gap-2.5 group">
						<div className="flex size-8 items-center justify-center rounded-lg bg-primary shadow-sm group-hover:bg-primary/90 transition-colors">
							<svg
								className="size-4 text-primary-foreground"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
							</svg>
						</div>
						<span className="font-semibold text-foreground tracking-tight">
							Acme
						</span>
					</Link>

					{/* Center nav */}
					<nav className="hidden md:flex items-center gap-1">
						{[
							{ label: "Features", href: "#features" },
							{ label: "Pricing", href: "#pricing" },
							{ label: "Docs", href: "#docs" },
							{ label: "Blog", href: "#blog" },
						].map((item) => (
							<Link
								key={item.href}
								href={item.href}
								className="px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
							>
								{item.label}
							</Link>
						))}
					</nav>

					{/* Right side */}
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm" asChild>
							<Link href="/sign-in">Sign in</Link>
						</Button>
						<Button size="sm" asChild>
							<Link href="/sign-up">Get started</Link>
						</Button>
					</div>
				</div>
			</header>

			<main className="flex-1">{children}</main>

			<footer className="border-t border-border/60 bg-muted/30">
				<div className="mx-auto max-w-6xl px-6 py-10">
					<div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
						<div className="flex items-center gap-2">
							<div className="flex size-6 items-center justify-center rounded-md bg-primary">
								<svg
									className="size-3 text-primary-foreground"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
								</svg>
							</div>
							<span className="text-sm font-medium">Acme</span>
						</div>
						<p className="text-xs text-muted-foreground">
							© {new Date().getFullYear()} Acme Inc. All rights reserved.
						</p>
						<div className="flex gap-4">
							{["Privacy", "Terms", "Contact"].map((item) => (
								<Link
									key={item}
									href="#"
									className="text-xs text-muted-foreground hover:text-foreground transition-colors"
								>
									{item}
								</Link>
							))}
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
