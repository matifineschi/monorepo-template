import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { ArrowUpRightIcon, BarChart3Icon, FolderIcon, UsersIcon, ZapIcon } from "lucide-react";
import { Card } from "@repo/ui/components/card";

const stats = [
	{
		label: "Total Users",
		value: "—",
		change: null,
		icon: UsersIcon,
		description: "Active accounts",
	},
	{
		label: "Projects",
		value: "—",
		change: null,
		icon: FolderIcon,
		description: "Active projects",
	},
	{
		label: "Events",
		value: "—",
		change: null,
		icon: ZapIcon,
		description: "This month",
	},
	{
		label: "Revenue",
		value: "—",
		change: null,
		icon: BarChart3Icon,
		description: "Monthly recurring",
	},
];

const quickActions = [
	{
		title: "Invite team members",
		description: "Add collaborators to your workspace",
		href: "/dashboard/settings",
		icon: UsersIcon,
	},
	{
		title: "Create a project",
		description: "Start organizing your work",
		href: "/dashboard/projects",
		icon: FolderIcon,
	},
	{
		title: "View analytics",
		description: "Track key metrics and trends",
		href: "/dashboard/analytics",
		icon: BarChart3Icon,
	},
];

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

function getFirstName(name: string): string {
	return name.split(" ")[0] ?? name;
}

export default async function DashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const greeting = getGreeting();
	const firstName = getFirstName(session?.user.name ?? "there");

	return (
		<div className="flex-1 space-y-8 p-6 lg:p-8">
			{/* Page header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					{greeting}, {firstName}
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Here&apos;s what&apos;s happening in your workspace today.
				</p>
			</div>

			{/* Stats grid */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{stats.map((stat) => (
					<Card
						key={stat.label}
						className="relative overflow-hidden p-5 shadow-none border-border/60 hover:border-border transition-colors"
					>
						<div className="flex items-start justify-between">
							<div>
								<p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
								<p className="mt-1.5 text-2xl font-bold tracking-tight">{stat.value}</p>
								<p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
							</div>
							<div className="flex size-9 items-center justify-center rounded-lg bg-muted/60">
								<stat.icon className="size-4 text-muted-foreground" />
							</div>
						</div>
					</Card>
				))}
			</div>

			{/* Quick actions + Activity */}
			<div className="grid gap-6 lg:grid-cols-3">
				{/* Quick actions */}
				<div className="lg:col-span-1">
					<h2 className="mb-4 text-sm font-semibold text-foreground">Quick actions</h2>
					<div className="space-y-2">
						{quickActions.map((action) => (
							<a
								key={action.title}
								href={action.href}
								className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-border hover:shadow-sm"
							>
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 group-hover:bg-primary/8 transition-colors">
									<action.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium leading-none">{action.title}</p>
									<p className="mt-1 text-xs text-muted-foreground truncate">{action.description}</p>
								</div>
								<ArrowUpRightIcon className="size-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
							</a>
						))}
					</div>
				</div>

				{/* Recent activity */}
				<div className="lg:col-span-2">
					<h2 className="mb-4 text-sm font-semibold text-foreground">Recent activity</h2>
					<div className="rounded-xl border border-border/60 bg-card overflow-hidden">
						<div className="flex flex-col items-center justify-center py-16 px-6 text-center">
							<div className="flex size-12 items-center justify-center rounded-xl bg-muted/60 mb-4">
								<ZapIcon className="size-5 text-muted-foreground" />
							</div>
							<p className="text-sm font-medium">No activity yet</p>
							<p className="mt-1 text-xs text-muted-foreground max-w-xs">
								Activity will appear here once you and your team start using the workspace.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
