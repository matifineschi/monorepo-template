import { childLogger } from "@repo/logger";
import { createError } from "@repo/utils/error";

import { env } from "../env";
import { type ExecOptions, type ExecResult, exec } from "./exec";

/**
 * rclone is the only way apps/cron talks to object storage — both buckets.
 *
 * Remotes are configured entirely through `RCLONE_CONFIG_<REMOTE>_*`
 * environment variables: no credentials file on disk, and nothing in argv
 * (argv is readable by every process on the host via `ps`).
 *
 *   src: the application's bucket (read-only credentials)
 *   dst: the backup bucket (write-limited credentials)
 */

const log = childLogger({ component: "rclone" });

/** rclone's exit code for "--max-duration reached". */
export const RCLONE_DURATION_EXCEEDED = 10;

export type S3Remote = {
	accessKeyId: string;
	endpoint: string;
	forcePathStyle: boolean;
	region: string;
	secretAccessKey: string;
};

/**
 * `provider: "Other"` makes rclone assume the baseline S3 API, so the same
 * configuration works against S3, R2, MinIO and Spaces.
 */
export function remoteEnv(
	name: string,
	remote: S3Remote,
): Record<string, string> {
	const prefix = `RCLONE_CONFIG_${name.toUpperCase()}`;
	return {
		[`${prefix}_ACCESS_KEY_ID`]: remote.accessKeyId,
		[`${prefix}_ENDPOINT`]: remote.endpoint,
		[`${prefix}_FORCE_PATH_STYLE`]: String(remote.forcePathStyle),
		[`${prefix}_PROVIDER`]: "Other",
		[`${prefix}_REGION`]: remote.region,
		[`${prefix}_SECRET_ACCESS_KEY`]: remote.secretAccessKey,
		[`${prefix}_TYPE`]: "s3",
	};
}

export function remotesEnv(): Record<string, string> {
	return {
		// Never read an on-disk config, even if one exists in the image.
		RCLONE_CONFIG: "/dev/null",
		...remoteEnv("src", {
			accessKeyId: env.SOURCE_S3_ACCESS_KEY_ID,
			endpoint: env.SOURCE_S3_ENDPOINT,
			forcePathStyle: env.SOURCE_S3_FORCE_PATH_STYLE,
			region: env.SOURCE_S3_REGION,
			secretAccessKey: env.SOURCE_S3_SECRET_ACCESS_KEY,
		}),
		...remoteEnv("dst", {
			accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID,
			endpoint: env.BACKUP_S3_ENDPOINT,
			forcePathStyle: env.BACKUP_S3_FORCE_PATH_STYLE,
			region: env.BACKUP_S3_REGION,
			secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
		}),
	};
}

/** `src:<bucket>/<path>` — the application's bucket. */
export function sourcePath(path = ""): string {
	return joinRemote("src", env.SOURCE_S3_BUCKET, path);
}

/** `dst:<bucket>/<path>` — the backup bucket. */
export function backupPath(path = ""): string {
	return joinRemote("dst", env.BACKUP_S3_BUCKET, path);
}

function joinRemote(remote: string, bucket: string, path: string): string {
	return path ? `${remote}:${bucket}/${path}` : `${remote}:${bucket}`;
}

export const BASE_FLAGS = [
	"--use-json-log",
	"--log-level",
	"INFO",
	// Write-limited credentials may not be allowed HeadBucket.
	"--s3-no-check-bucket",
];

/** What a caller may do with rclone's stdout. See ExecOptions for the trade-off. */
export type RcloneStdout = Pick<ExecOptions, "onStdoutLine" | "stdoutTo">;

/** Runs rclone; resolves with the exit code so callers can interpret it. */
export function rclone(
	args: string[],
	options: RcloneStdout = {},
): Promise<ExecResult> {
	return exec("rclone", [...BASE_FLAGS, ...args], {
		env: remotesEnv(),
		onStderrLine: forwardLogLine,
		onStdoutLine: options.onStdoutLine,
		stdoutTo: options.stdoutTo,
	});
}

/** rclone, where any non-zero exit is an error. */
export async function rcloneOrThrow(
	args: string[],
	options: RcloneStdout = {},
): Promise<void> {
	const { exitCode, stderr } = await rclone(args, options);
	if (exitCode !== 0) {
		throw createError("rclone failed", {
			context: { command: args[0], exitCode, stderr },
		});
	}
}

export type RemoteObject = { path: string; size: number; modTime: Date };

/** Files under a backup-bucket path, newest first. */
export async function listBackupObjects(path: string): Promise<RemoteObject[]> {
	let json = "";
	await rcloneOrThrow(
		["lsjson", backupPath(path), "--recursive", "--files-only"],
		{
			onStdoutLine: (line) => {
				json += line;
			},
		},
	);

	const entries = JSON.parse(json || "[]") as {
		Path: string;
		Size: number;
		ModTime: string;
	}[];

	return entries
		.map((entry) => ({
			modTime: new Date(entry.ModTime),
			path: path ? `${path}/${entry.Path}` : entry.Path,
			size: entry.Size,
		}))
		.sort((a, b) => b.modTime.getTime() - a.modTime.getTime());
}

type RcloneLogLine = { level?: string; msg?: string; object?: string };

function forwardLogLine(line: string): void {
	if (!line.trim()) return;

	let parsed: RcloneLogLine;
	try {
		parsed = JSON.parse(line) as RcloneLogLine;
	} catch {
		log.debug({ line }, "rclone");
		return;
	}

	const fields = { object: parsed.object };
	const message = parsed.msg ?? "rclone";

	if (parsed.level === "error" || parsed.level === "critical") {
		log.error(fields, message);
	} else if (parsed.level === "warning") {
		// rclone uses NOTICE ("warning" in JSON) for routine summaries.
		log.info(fields, message);
	} else {
		log.debug(fields, message);
	}
}
