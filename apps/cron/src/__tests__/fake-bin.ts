import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Puts shell-script stand-ins for pg_dump / pg_restore / rclone at the front of
 * PATH, so job logic can be tested without the real binaries. Every invocation
 * appends its argv to `calls.log`.
 */
export async function installFakeBins(scripts: Record<string, string>) {
	const directory = await mkdtemp(join(tmpdir(), "cron-fake-bin-"));
	const callLog = join(directory, "calls.log");
	const originalPath = process.env.PATH;

	for (const [name, body] of Object.entries(scripts)) {
		const path = join(directory, name);
		await writeFile(
			path,
			`#!/bin/sh\necho "${name} $*" >> "${callLog}"\n${body}\n`,
			"utf8",
		);
		await chmod(path, 0o755);
	}
	await writeFile(callLog, "", "utf8");
	process.env.PATH = `${directory}:${originalPath}`;

	return {
		async calls(): Promise<string[]> {
			return (await readFile(callLog, "utf8")).split("\n").filter(Boolean);
		},
		async restore(): Promise<void> {
			process.env.PATH = originalPath;
			await rm(directory, { force: true, recursive: true });
		},
	};
}

/** Shell snippet: the value following `--file` in "$@". */
export const ARG_AFTER_FILE = `out=""; prev=""; for a in "$@"; do [ "$prev" = "--file" ] && out="$a"; prev="$a"; done`;
