import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { createError } from "@repo/utils/error";

export type ExecOptions = {
	/** Added to the inherited environment. Put credentials here, never in args. */
	env?: Record<string, string>;
	/**
	 * Per-line stdout callback. For output you need to *inspect*, and only where
	 * it is bounded — a callback cannot apply backpressure, so whatever the
	 * handler cannot keep up with is buffered in memory.
	 */
	onStdoutLine?: (line: string) => void;
	/**
	 * Pipe stdout into this stream instead. For bulk output — a listing of every
	 * object in a bucket — because `pipeline` propagates backpressure, so the
	 * child is paused when the destination is slow rather than the whole listing
	 * accumulating in this process.
	 */
	stdoutTo?: Writable;
	onStderrLine?: (line: string) => void;
};

export type ExecResult = { exitCode: number; stderr: string };

const STDERR_TAIL_CHARS = 4000;

/**
 * Runs a binary (pg_dump, pg_restore, rclone) and resolves with its exit code.
 *
 * Does not throw on a non-zero exit, because callers give exit codes different
 * meanings (rclone: 1 = "differences found", 10 = "time budget reached"). It
 * does throw if the binary cannot be started at all.
 *
 * The only file in apps/cron that reads `process.env` outside env.ts (Biome
 * override): a child process needs PATH and TMPDIR to work at all.
 */
export async function exec(
	command: string,
	args: string[],
	options: ExecOptions = {},
): Promise<ExecResult> {
	const wantsStdout = Boolean(options.onStdoutLine || options.stdoutTo);
	const child = spawn(command, args, {
		env: { ...process.env, ...options.env },
		stdio: ["ignore", wantsStdout ? "pipe" : "ignore", "pipe"],
	});

	let stderr = "";
	if (child.stderr) {
		createInterface({ input: child.stderr }).on("line", (line) => {
			stderr = `${stderr}${line}\n`.slice(-STDERR_TAIL_CHARS);
			options.onStderrLine?.(line);
		});
	}

	// Started before the exit is awaited, so the child is never blocked writing
	// into a pipe nothing is reading.
	const piped =
		child.stdout && options.stdoutTo
			? pipeline(child.stdout, options.stdoutTo)
			: Promise.resolve();

	if (child.stdout && options.onStdoutLine) {
		createInterface({ input: child.stdout }).on("line", options.onStdoutLine);
	}

	const exitCode = await new Promise<number>((resolve, reject) => {
		child.on("error", (error) =>
			reject(
				createError("Failed to start process", {
					cause: error,
					context: { command, hint: `is ${command} installed?` },
				}),
			),
		);
		child.on("close", (code) => resolve(code ?? 1));
	});

	// A write error on the destination — a full disk, most likely — must fail the
	// call rather than leaving a short file that looks like a complete listing.
	await piped;

	return { exitCode, stderr: stderr.trim() };
}

/** `exec`, but any non-zero exit is an error. */
export async function execOrThrow(
	command: string,
	args: string[],
	options: ExecOptions = {},
): Promise<void> {
	const { exitCode, stderr } = await exec(command, args, options);
	if (exitCode !== 0) {
		throw createError("Process exited non-zero", {
			context: { command, exitCode, stderr },
		});
	}
}
