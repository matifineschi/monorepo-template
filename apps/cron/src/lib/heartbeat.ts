import { logger } from "@repo/logger";
import { withTimeout } from "@repo/utils/timeout";

const TIMEOUT_MS = 10_000;

export type HeartbeatEvent = "start" | "success" | "fail";

/** healthchecks.io / Better Stack convention: `/start`, bare URL, `/fail`. */
export function heartbeatUrl(base: string, event: HeartbeatEvent): string {
	const trimmed = base.replace(/\/+$/, "");
	if (event === "success") return trimmed;
	return `${trimmed}/${event}`;
}

/**
 * Pings a cron monitor. The monitor alerts when a success ping does not arrive
 * on time, which is the only way to catch a job that never ran at all.
 *
 * Never throws: a monitoring outage must not fail a backup that succeeded.
 */
export async function sendHeartbeat(
	base: string | undefined,
	event: HeartbeatEvent,
	body?: string,
): Promise<void> {
	if (!base) return;

	try {
		const response = await withTimeout(
			fetch(heartbeatUrl(base, event), { body, method: "POST" }),
			TIMEOUT_MS,
			"heartbeat",
		);
		if (!response.ok) {
			logger.warn({ event, status: response.status }, "Heartbeat rejected");
		}
	} catch (error) {
		logger.warn({ err: error, event }, "Heartbeat failed");
	}
}
