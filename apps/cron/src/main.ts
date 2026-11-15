import { childLogger, logger } from "@repo/logger";

import { env } from "./env";
import { findJob, JOBS, type Job } from "./jobs";
import { sendHeartbeat } from "./lib/heartbeat";
import { withAdvisoryLock } from "./lib/postgres";

/**
 * Entrypoint. Runs one job and exits — scheduling is the platform's job.
 *
 *   bun run src/main.ts <job>        (dev)
 *   bun run dist/main.js <job>       (container)
 *
 * Exit codes: 0 ran or skipped, 1 failed, 2 usage error. A non-zero exit is
 * what makes the platform's cron report the run as failed.
 */
export async function main(argv: string[]): Promise<number> {
	const [name] = argv;
	const job = name ? findJob(name) : undefined;

	if (!job) {
		logger.error(
			{ job: name, known: JOBS.map((entry) => entry.name) },
			"Usage: main.ts <job>",
		);
		return 2;
	}

	return (await runJob(job)) === "failed" ? 1 : 0;
}

export type JobOutcome = "ran" | "skipped" | "failed";

/** Runs a job under its advisory lock, with heartbeats and timing. Never throws. */
export async function runJob(job: Job): Promise<JobOutcome> {
	const log = childLogger({ job: job.name });
	const startedAt = performance.now();
	const elapsed = () => Math.round(performance.now() - startedAt);

	try {
		/**
		 * The `start` ping goes inside the lock so a skipped run pings nothing at
		 * all. Pinging `start` first and then returning early left the monitor
		 * holding a run it never saw finish, and it alerts once the grace period
		 * passes — so a benign overlap, which is exactly what the lock is for,
		 * raised a false alarm. A monitor that cries wolf gets muted, and this one
		 * is the only thing that catches a job nobody wired up on the platform.
		 *
		 * Silence on a skip is also the honest signal. The run still holding the
		 * lock will ping `success` when it finishes, so the monitor is satisfied by
		 * that; and a run wedged forever means no success ever arrives and every
		 * later run skips, which is a missed backup the monitor *should* report.
		 * Pinging `success` for a skip would mask precisely that.
		 */
		const outcome = await withAdvisoryLock(
			env.DATABASE_URL,
			job.name,
			async () => {
				await sendHeartbeat(job.heartbeatUrl, "start");
				return await job.run();
			},
		);

		if (!outcome.acquired) {
			log.info("Skipped: another run of this job is in progress");
			return "skipped";
		}

		log.info({ durationMs: elapsed(), result: outcome.value }, "Job completed");
		await sendHeartbeat(job.heartbeatUrl, "success");
		return "ran";
	} catch (error) {
		log.error({ durationMs: elapsed(), err: error }, "Job failed");
		await sendHeartbeat(
			job.heartbeatUrl,
			"fail",
			error instanceof Error ? error.message : String(error),
		);
		return "failed";
	}
}

if (import.meta.main) {
	process.exit(await main(process.argv.slice(2)));
}
