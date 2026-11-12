/**
 * The repo's error constructor.
 *
 * Two rules make errors useful in aggregate rather than individually:
 *
 * - `message` is **static** for a given failure class, so a log search or an
 *   error-reporting tool groups every occurrence together. "Upload is not
 *   durable", not `Upload ${key} is not durable`.
 * - incident detail goes in `context`, as structured fields a human can read
 *   and a tool can filter on.
 *
 * `cause` accepts anything throwable and is normalized through `ensureError`,
 * so the chain stays walkable even when the thing you caught was a string.
 */

type ErrorContext = Record<string, unknown>;

/** At least one of `cause` / `context` — a bare `createError(msg)` needs neither. */
type CreateErrorOptions =
	| { cause: unknown; context?: ErrorContext }
	| { cause?: unknown; context: ErrorContext };

export type AppError = Error & { context?: ErrorContext };

export function createError(
	message: string,
	options?: CreateErrorOptions,
): AppError {
	const cause =
		options?.cause !== undefined ? ensureError(options.cause) : undefined;
	const error = new Error(message, cause ? { cause } : undefined) as AppError;

	if (options?.context !== undefined) {
		error.context = options.context;
	}

	// Drops this frame from the stack so the trace starts at the caller.
	Error.captureStackTrace?.(error, createError);

	return error;
}

/**
 * Normalizes an unknown throwable to an Error.
 *
 * `catch (error)` is typed `unknown` because JavaScript lets you throw a string,
 * a number, or `undefined`. Everything downstream — logging, Sentry, `.message`
 * — assumes an Error, so convert once at the boundary.
 */
export function ensureError(value: unknown): Error {
	if (value instanceof Error) return value;
	if (value === null || value === undefined) return new Error("Unknown error");
	if (typeof value === "string") return new Error(value);
	return new Error("Unknown error", { cause: value });
}

/** The `context` of an AppError, or undefined for a plain Error. */
export function errorContext(error: unknown): ErrorContext | undefined {
	if (!(error instanceof Error)) return undefined;
	const context = (error as AppError).context;
	return context && typeof context === "object" ? context : undefined;
}

/**
 * Walks the `cause` chain, outermost first. Capped because a cause chain can be
 * cyclic — `a.cause = b; b.cause = a` is not rejected by anything.
 */
export function errorChain(error: unknown, maxDepth = 10): Error[] {
	const chain: Error[] = [];
	const seen = new Set<unknown>();
	let current: unknown = error;

	while (current !== undefined && current !== null && chain.length < maxDepth) {
		if (seen.has(current)) break;
		seen.add(current);
		const normalized = ensureError(current);
		chain.push(normalized);
		current = normalized.cause;
	}

	return chain;
}
