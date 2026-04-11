"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	BarChart3Icon,
	BellIcon,
	FolderIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	SearchIcon,
	SettingsIcon,
	UserIcon,
} from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "@repo/ui/components/sidebar";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Separator } from "@repo/ui/components/separator";
import { signOut } from "@/lib/auth-client";

const navMain = [
	{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
	{ title: "Analytics", url: "/dashboard/analytics", icon: BarChart3Icon },
	{ title: "Projects", url: "/dashboard/projects", icon: FolderIcon },
];

const navSecondary = [
	{ title: "Settings", url: "/dashboard/settings", icon: SettingsIcon },
];

type User = {
	name: string;
	email: string;
};

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function AppSidebar({ user }: { user: User }) {
	const pathname = usePathname();
	const router = useRouter();

	async function handleSignOut() {
		await signOut();
		router.push("/sign-in");
	}

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link href="/dashboard">
								<div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
									<svg
										className="size-4"
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
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">Acme</span>
									<span className="truncate text-xs text-muted-foreground">Workspace</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navMain.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										isActive={pathname === item.url}
										tooltip={item.title}
									>
										<Link href={item.url}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup className="mt-auto">
					<SidebarGroupContent>
						<SidebarMenu>
							{navSecondary.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										isActive={pathname === item.url}
										tooltip={item.title}
									>
										<Link href={item.url}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar className="size-8 rounded-lg">
										<AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
											{getInitials(user.name)}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{user.name}</span>
										<span className="truncate text-xs text-muted-foreground">{user.email}</span>
									</div>
									<svg
										className="ml-auto size-4 text-muted-foreground"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										aria-hidden="true"
									>
										<path d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
									</svg>
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-56 rounded-xl"
								side="top"
								align="end"
								sideOffset={8}
							>
								<DropdownMenuLabel className="p-0 font-normal">
									<div className="flex items-center gap-2 px-2 py-2">
										<Avatar className="size-8 rounded-lg">
											<AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
												{getInitials(user.name)}
											</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-medium">{user.name}</span>
											<span className="truncate text-xs text-muted-foreground">{user.email}</span>
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link href="/dashboard/settings/profile" className="cursor-pointer">
										<UserIcon className="size-4" />
										Profile
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link href="/dashboard/settings" className="cursor-pointer">
										<SettingsIcon className="size-4" />
										Settings
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive cursor-pointer"
									onClick={handleSignOut}
								>
									<LogOutIcon className="size-4" />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}

function DashboardHeader({ user }: { user: User }) {
	const pathname = usePathname();
	const segments = pathname.replace("/dashboard", "").split("/").filter(Boolean);

	return (
		<header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4">
			<SidebarTrigger className="-ml-1" />
			<Separator orientation="vertical" className="h-4" />

			{/* Breadcrumb */}
			<nav className="flex items-center gap-1 text-sm text-muted-foreground">
				<Link href="/dashboard" className="hover:text-foreground transition-colors">
					Dashboard
				</Link>
				{segments.map((seg, i) => (
					<span key={seg} className="flex items-center gap-1">
						<span className="text-border">/</span>
						<span
							className={
								i === segments.length - 1 ? "font-medium text-foreground" : "hover:text-foreground"
							}
						>
							{seg.charAt(0).toUpperCase() + seg.slice(1)}
						</span>
					</span>
				))}
			</nav>

			{/* Right side actions */}
			<div className="ml-auto flex items-center gap-1">
				<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
					<SearchIcon className="size-4" />
					<span className="sr-only">Search</span>
				</Button>
				<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
					<BellIcon className="size-4" />
					<span className="sr-only">Notifications</span>
				</Button>
				<Separator orientation="vertical" className="mx-1 h-4" />
				<Avatar className="size-7 rounded-lg">
					<AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
						{getInitials(user.name)}
					</AvatarFallback>
				</Avatar>
			</div>
		</header>
	);
}

export function DashboardShell({
	user,
	children,
}: {
	user: User;
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider>
			<AppSidebar user={user} />
			<SidebarInset>
				<DashboardHeader user={user} />
				<div className="flex flex-1 flex-col">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
