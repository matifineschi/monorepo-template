import { Button } from "@repo/ui/components/button";

export default function Home() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
			<h1 className="text-4xl font-bold tracking-tight">Web</h1>
			<p className="text-muted-foreground">
				Edit{" "}
				<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
					apps/web/app/page.tsx
				</code>{" "}
				to get started.
			</p>
			<Button>Get started</Button>
		</div>
	);
}
