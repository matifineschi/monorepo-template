import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import postgres from "postgres";

import { env } from "../../src/env";
import { lockKey } from "../../src/lib/postgres";
import { runJob } from "../../src/main";

/**
 * What `runJob` reports to the cron monitor, against a real Postgres advisory
 * lock.
 *
 * The regression this exists for: the `start` ping used to be sent before the
 * lock was taken, so a skipped run left the monitor holding a run it never saw
 * finish. The monitor alerts when the grace period passes, which turned a
 * benign overlap — the thing the lock is *for* — into a false alarm. And a
 * monitor that cries wolf is one people mute, which matters because it is the
 * only thing that catches a job nobody wired up on the platform.
 */

let pings: string[] = [];
let server: ReturnType<typeof Bun.serve> | undefined;
let base = "";

beforeEach(() => {
	pings = [];
	server = Bun.serve({
		fetch(request) {
			pings.push(new URL(request.url).pathname);
			return new Response("ok");
		},
		port: 0,
	});
	base = `http://127.0.0.1:${server.port}/hb`;
});

afterEach(() => {
	server?.stop(true);
	server = undefined;
});

/** Holds the job's advisory lock from another session, as a concurrent run would. */
async function withLockHeldFor<T>(
	jobName: string,
	body: () => Promise<T>,
): Promise<T> {
	const holder = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
	try {
		const [row] = await holder<{ locked: boolean }[]>`
			select pg_try_advisory_lock(${lockKey(jobName)}::bigint) as locked
		`;
		if (!row?.locked) {
			throw new Error("Could not take the lock the test depends on");
		}
		try {
			return await body();
		} finally {
			await holder`select pg_advisory_unlock(${lockKey(jobName)}::bigint)`;
		}
	} finally {
		await holder.end({ timeout: 5 });
	}
}

/** Heartbeat sends are awaited inside runJob, but the server logs them async. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("runJob heartbeats", () => {
	test("a skipped run pings nothing at all", async () => {
		let ran = false;

		const outcome = await withLockHeldFor("skip-probe", () =>
			runJob({
				heartbeatUrl: base,
				name: "skip-probe",
				run: async () => {
					ran = true;
				},
			}),
		);
		await settle();

		expect(outcome).toBe("skipped");
		expect(ran).toBe(false);
		// Not ["/hb/start"] — that was the bug.
		expect(pings).toEqual([]);
	});

	test("a successful run pings start then success", async () => {
		const outcome = await runJob({
			heartbeatUrl: base,
			name: "success-probe",
			run: async () => ({ ok: true }),
		});
		await settle();

		expect(outcome).toBe("ran");
		// healthchecks.io convention: `/start`, then the bare URL for success.
		expect(pings).toEqual(["/hb/start", "/hb"]);
	});

	test("a failing run pings start then fail, and reports failure", async () => {
		const outcome = await runJob({
			heartbeatUrl: base,
			name: "failure-probe",
			run: async () => {
				throw new Error("the job blew up");
			},
		});
		await settle();

		expect(outcome).toBe("failed");
		expect(pings).toEqual(["/hb/start", "/hb/fail"]);
	});

	test("the lock is released, so a second run is not skipped", async () => {
		await runJob({
			heartbeatUrl: base,
			name: "release-probe",
			run: async () => {},
		});
		const second = await runJob({
			heartbeatUrl: base,
			name: "release-probe",
			run: async () => {},
		});

		expect(second).toBe("ran");
	});

	test("a job with no heartbeat configured still runs", async () => {
		let ran = false;

		const outcome = await runJob({
			heartbeatUrl: undefined,
			name: "no-heartbeat-probe",
			run: async () => {
				ran = true;
			},
		});
		await settle();

		expect(outcome).toBe("ran");
		expect(ran).toBe(true);
		expect(pings).toEqual([]);
	});
});
