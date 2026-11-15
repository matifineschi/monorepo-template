import postgres from "postgres";

import { createError } from "@repo/utils/error";

/**
 * libpq environment variables for a connection URL.
 *
 * pg_dump and pg_restore get their connection through these, never through
 * argv: a URL in argv puts the password in `ps` output for every process on
 * the host.
 */
export function pgEnv(url: string): Record<string, string> {
	const parsed = new URL(url);
	const vars: Record<string, string> = {
		PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)) || "postgres",
		PGHOST: parsed.hostname,
		PGPORT: parsed.port || "5432",
		PGUSER: decodeURIComponent(parsed.username),
	};
	if (parsed.password) vars.PGPASSWORD = decodeURIComponent(parsed.password);

	const sslMode = parsed.searchParams.get("sslmode");
	if (sslMode) vars.PGSSLMODE = sslMode;

	return vars;
}

/** The same URL pointed at another database on the same server. */
export function withDatabase(url: string, database: string): string {
	const parsed = new URL(url);
	parsed.pathname = `/${database}`;
	return parsed.toString();
}

export function connect(url: string) {
	return postgres(url, {
		connect_timeout: 10,
		idle_timeout: 0,
		max: 1,
		onnotice: () => {},
	});
}

/** Stable 32-bit key from a job name, so every instance computes the same one. */
export function lockKey(name: string): number {
	let hash = 0;
	for (let index = 0; index < name.length; index += 1) {
		hash = (Math.imul(hash, 31) + name.charCodeAt(index)) | 0;
	}
	return hash;
}

export type LockOutcome<T> = { acquired: true; value: T } | { acquired: false };

/**
 * Runs `work` under a Postgres advisory lock, or skips if someone holds it.
 *
 * Platform cron normally prevents overlapping runs; this also covers a manual
 * run during an incident landing on top of a scheduled one. The lock is
 * session-scoped, so Postgres drops it if the process is killed mid-run.
 */
export async function withAdvisoryLock<T>(
	url: string,
	name: string,
	work: () => Promise<T>,
): Promise<LockOutcome<T>> {
	const sql = connect(url);
	const key = lockKey(name);

	try {
		const [row] = await sql<
			{ locked: boolean }[]
		>`select pg_try_advisory_lock(${key}::bigint) as locked`;
		if (!row) {
			throw createError("Advisory lock query returned no row", {
				context: { name },
			});
		}
		if (!row.locked) return { acquired: false };

		try {
			return { acquired: true, value: await work() };
		} finally {
			await sql`select pg_advisory_unlock(${key}::bigint)`;
		}
	} finally {
		await sql.end({ timeout: 5 });
	}
}
