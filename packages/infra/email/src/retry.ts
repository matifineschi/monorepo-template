/**
 * Which Resend failures are worth another attempt.
 *
 * Network failures (the SDK reports them with a null status), 5xx and 429 are
 * transient. Every other 4xx — a bad sender, a restricted key, a malformed
 * address — fails the same way on every attempt, so retrying only delays the
 * error and burns quota.
 */
export function isRetryable(statusCode: number | null): boolean {
	if (statusCode === null) return true;
	return statusCode === 429 || statusCode >= 500;
}

const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 5_000;

/**
 * Exponential backoff with full jitter, unless the server named its own wait in
 * `retry-after` (seconds), which always wins: hammering a rate limiter sooner
 * than it asked just earns another 429.
 */
export function retryDelayMs(
	attempt: number,
	retryAfter: string | null | undefined,
	random: () => number = Math.random,
): number {
	const fromHeader = retryAfter ? Number(retryAfter) : Number.NaN;
	if (Number.isFinite(fromHeader) && fromHeader >= 0) {
		return Math.min(fromHeader * 1000, MAX_DELAY_MS);
	}
	const ceiling = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
	return Math.round(random() * ceiling);
}
