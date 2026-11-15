import { createError } from "./error";

/**
 * Rejects if `work` has not settled within `ms`.
 *
 * For dependency checks and other calls to things that can be *slow* rather
 * than *down*. A TCP connection to a host that is dropping packets does not
 * error — it hangs until the OS gives up, which can be minutes. A readiness
 * probe that hangs is worse than one that fails, because the orchestrator
 * learns nothing either way and the request occupies a connection meanwhile.
 *
 * The timer is always cleared: an un-cleared `setTimeout` keeps the event loop
 * alive, which turns a fast script into one that appears to hang on exit.
 */
export async function withTimeout<T>(
	work: Promise<T>,
	ms: number,
	label: string,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	try {
		return await Promise.race([
			work,
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(
					() =>
						reject(
							createError("Timed out", { context: { label, timeoutMs: ms } }),
						),
					ms,
				);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}
