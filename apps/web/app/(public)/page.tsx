import Link from "next/link";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";

const features = [
	{
		icon: (
			<svg
				className="size-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
			</svg>
		),
		title: "Authentication built-in",
		description:
			"Secure email and password auth powered by Better Auth with PostgreSQL session storage. Ready to extend with OAuth, 2FA, and more.",
	},
	{
		icon: (
			<svg
				className="size-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
				<path d="M8 21h8M12 17v4" />
			</svg>
		),
		title: "Full-stack TypeScript",
		description:
			"End-to-end type safety from database schema to UI components. Drizzle ORM, Next.js App Router, and a shared UI package — all in one repo.",
	},
	{
		icon: (
			<svg
				className="size-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
				<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
				<line x1="12" y1="22.08" x2="12" y2="12" />
			</svg>
		),
		title: "Turborepo monorepo",
		description:
			"Blazing-fast builds with intelligent caching. Share code across apps and packages with zero friction using Bun workspaces.",
	},
	{
		icon: (
			<svg
				className="size-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="3" />
				<path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
			</svg>
		),
		title: "Component library",
		description:
			"60+ accessible components built on Radix UI and Tailwind CSS v4. Sidebars, forms, data tables, charts — everything you need from day one.",
	},
	{
		icon: (
			<svg
				className="size-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
			</svg>
		),
		title: "Production-ready patterns",
		description:
			"Route protection via middleware, server-side session checks, form validation with Zod, and server actions — best practices baked in.",
	},
	{
		icon: (
			<svg
				className="size-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
			</svg>
		),
		title: "Developer experience",
		description:
			"Biome for lightning-fast linting and formatting, Docker Compose for the local database, and Drizzle Studio for visual schema inspection.",
	},
];

export default function HomePage() {
	return (
		<div className="flex flex-col">
			{/* Hero */}
			<section className="relative overflow-hidden px-6 py-24 sm:py-32">
				{/* Subtle background grid */}
				<div
					className="absolute inset-0 -z-10 opacity-[0.03]"
					style={{
						backgroundImage:
							"linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
						backgroundSize: "48px 48px",
					}}
					aria-hidden="true"
				/>
				{/* Glow */}
				<div
					className="absolute top-0 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/4 h-96 w-96 rounded-full opacity-10 blur-3xl bg-primary"
					aria-hidden="true"
				/>

				<div className="mx-auto max-w-4xl text-center">
					<Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1 text-xs font-medium">
						<span className="relative flex size-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
							<span className="relative inline-flex size-2 rounded-full bg-primary" />
						</span>
						Open source monorepo template · v1.0
					</Badge>

					<h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
						Ship your next{" "}
						<span
							className="bg-clip-text text-transparent"
							style={{
								backgroundImage:
									"linear-gradient(135deg, oklch(0.5 0.2 265) 0%, oklch(0.65 0.22 295) 50%, oklch(0.6 0.25 320) 100%)",
							}}
						>
							SaaS faster
						</span>
					</h1>

					<p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
						A production-ready monorepo with Next.js, Better Auth, Drizzle ORM, and a full component
						library. Skip the boilerplate and focus on what makes your product unique.
					</p>

					<div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
						<Button size="lg" asChild className="h-11 px-8 text-sm font-medium">
							<Link href="/sign-up">Get started for free</Link>
						</Button>
						<Button variant="outline" size="lg" asChild className="h-11 px-8 text-sm font-medium">
							<Link href="#features" className="flex items-center gap-2">
								Explore features
								<svg
									className="size-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M5 12h14M12 5l7 7-7 7" />
								</svg>
							</Link>
						</Button>
					</div>

					<p className="mt-4 text-xs text-muted-foreground/70">
						No credit card required · Open source · MIT license
					</p>
				</div>
			</section>

			{/* Features */}
			<section id="features" className="px-6 py-20 sm:py-28">
				<div className="mx-auto max-w-6xl">
					<div className="text-center mb-16">
						<h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
							Everything you need, nothing you don&apos;t
						</h2>
						<p className="mt-4 text-muted-foreground max-w-xl mx-auto">
							Carefully chosen technologies that work together seamlessly, so you can move fast
							without breaking things.
						</p>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => (
							<div
								key={feature.title}
								className="group relative rounded-xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-border"
							>
								<div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/15 group-hover:bg-primary/12 transition-colors">
									{feature.icon}
								</div>
								<h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
								<p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA Banner */}
			<section className="px-6 py-16 sm:py-20">
				<div className="mx-auto max-w-6xl">
					<div
						className="relative overflow-hidden rounded-2xl px-8 py-12 sm:px-12 text-center"
						style={{
							background:
								"linear-gradient(135deg, oklch(0.18 0.02 265) 0%, oklch(0.22 0.04 295) 100%)",
						}}
					>
						<div
							className="absolute inset-0 opacity-5"
							style={{
								backgroundImage:
									"radial-gradient(circle at 20% 50%, oklch(0.8 0.2 265), transparent 50%), radial-gradient(circle at 80% 50%, oklch(0.8 0.2 320), transparent 50%)",
							}}
							aria-hidden="true"
						/>
						<div className="relative">
							<h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
								Ready to build something great?
							</h2>
							<p className="mt-3 text-sm text-white/60 max-w-md mx-auto">
								Clone the repo, configure your environment, and you&apos;re live in minutes.
							</p>
							<div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
								<Button
									size="lg"
									className="h-10 px-7 text-sm font-medium bg-white text-foreground hover:bg-white/90"
									asChild
								>
									<Link href="/sign-up">Start building now</Link>
								</Button>
								<Button
									variant="ghost"
									size="lg"
									className="h-10 px-7 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10"
									asChild
								>
									<Link href="/sign-in">Sign in</Link>
								</Button>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
