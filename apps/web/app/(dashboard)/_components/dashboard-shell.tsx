"use client";

import { AppShell } from "@astryxdesign/core/AppShell";
import { Avatar } from "@astryxdesign/core/Avatar";
import { BreadcrumbItem, Breadcrumbs } from "@astryxdesign/core/Breadcrumbs";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import {
	SideNav,
	SideNavHeading,
	SideNavItem,
	SideNavSection,
} from "@astryxdesign/core/SideNav";
import { HStack } from "@astryxdesign/core/Stack";
import { TopNav } from "@astryxdesign/core/TopNav";
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
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { BrandMark } from "../../_components/brand-mark";

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

function AppSideNav({ user }: { user: User }) {
	const pathname = usePathname();
	const router = useRouter();

	async function handleSignOut() {
		await signOut();
		router.push("/sign-in");
	}

	return (
		<SideNav
			collapsible
			// Persists width and collapsed state across reloads, which is what the
			// previous sidebar used a cookie for.
			resizable={{ autoSaveId: "dashboard-sidenav" }}
			header={
				<SideNavHeading
					heading="Acme"
					subheading="Workspace"
					headingHref="/dashboard"
					icon={<BrandMark />}
				/>
			}
			footer={
				<DropdownMenu
					placement="above"
					alignment="end"
					// A real Button, not a styled div: the trigger must be
					// focusable and announce aria-haspopup / aria-expanded.
					renderTrigger={(props) => (
						<Button
							{...props}
							variant="ghost"
							label={user.name}
							width="100%"
							icon={
								<Avatar
									name={user.name}
									size="xsm"
									shape="rounded"
									tooltip={false}
								/>
							}
						/>
					)}
					items={[
						{ type: "section", title: user.email, items: [
							{ label: "Profile", href: "/dashboard/settings/profile", icon: <UserIcon /> },
							{ label: "Settings", href: "/dashboard/settings", icon: <SettingsIcon /> },
						] },
						{ type: "divider" },
						{
							label: "Sign out",
							icon: <LogOutIcon />,
							variant: "destructive",
							onClick: handleSignOut,
						},
					]}
				/>
			}
		>
			<SideNavSection title="Navigation">
				{navMain.map((item) => (
					<SideNavItem
						key={item.url}
						label={item.title}
						icon={item.icon}
						href={item.url}
						isSelected={pathname === item.url}
					/>
				))}
			</SideNavSection>

			<SideNavSection title="Workspace" isHeaderHidden>
				{navSecondary.map((item) => (
					<SideNavItem
						key={item.url}
						label={item.title}
						icon={item.icon}
						href={item.url}
						isSelected={pathname === item.url}
					/>
				))}
			</SideNavSection>
		</SideNav>
	);
}

function DashboardBreadcrumbs() {
	const pathname = usePathname();
	const segments = pathname
		.replace("/dashboard", "")
		.split("/")
		.filter(Boolean);

	return (
		<Breadcrumbs variant="supporting">
			<BreadcrumbItem href={segments.length ? "/dashboard" : undefined}>
				Dashboard
			</BreadcrumbItem>
			{segments.map((seg, i) => (
				<BreadcrumbItem
					key={seg}
					href={
						i === segments.length - 1
							? undefined
							: `/dashboard/${segments.slice(0, i + 1).join("/")}`
					}
				>
					{seg.charAt(0).toUpperCase() + seg.slice(1)}
				</BreadcrumbItem>
			))}
		</Breadcrumbs>
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
		<AppShell
			contentPadding={6}
			sideNav={<AppSideNav user={user} />}
			topNav={
				<TopNav
					label="Dashboard"
					startContent={<DashboardBreadcrumbs />}
					endContent={
						<HStack gap={1} align="center">
							<IconButton
								label="Search"
								variant="ghost"
								size="sm"
								icon={<SearchIcon />}
							/>
							<IconButton
								label="Notifications"
								variant="ghost"
								size="sm"
								icon={<BellIcon />}
							/>
							<Avatar name={user.name} size="sm" shape="rounded" />
						</HStack>
					}
				/>
			}
		>
			{children}
		</AppShell>
	);
}
