import { ensureError } from "./error";

/**
 * Explicit success/failure as a return value, for outcomes a caller is expected
 * to branch on.
 *
 * The distinction worth holding onto: a `Result` is for an outcome that is part
 * of the contract ("this email is already taken"), and a thrown error is for a
 * broken assumption ("the database is unreachable"). Modelling the first as a
 * throw loses it in a generic 500 handler; modelling the second as a `Result`
 * makes every caller carry a branch it cannot do anything about.
 *
 * The second generic narrows the failure to known string literals, so a
 * `switch` over `result.code` is exhaustively checked.
 *
 * @example
 * type SignUpResult = Result<User, "email-taken" | "password-too-weak">;
 */
export type Result<R, C extends string> =
	| { ok: true; value: R }
	| { ok: false; code: C; cause?: Error };

/** The outcome of wrapping throwing code: the error is an Error, not a code. */
export type TryResult<T> = { ok: true; value: T } | { ok: false; error: Error };

/**
 * `NoInfer` lets the return-type annotation drive excess-property checking on
 * an inline object literal, instead of the literal widening the type.
 */
export function ok<R>(value: NoInfer<R>): Result<R, never> {
	return { ok: true, value };
}

/**
 * Pass `cause` when mapping a caught throwable into a domain code, so the
 * original failure can still be logged at a boundary.
 *
 * @example
 * const saved = await tryAsyncResult(() => repository.save(user));
 * if (!saved.ok) return err("save-failed", saved.error);
 */
export function err<const C extends string>(
	code: C,
	cause?: Error,
): Result<never, C> {
	return cause === undefined ? { ok: false, code } : { ok: false, code, cause };
}

// `any` satisfies both branches of every conditional type, so detect it and
// bail out — otherwise callbacks returning `any` (JSON.parse) get rejected.
type IsAny<T> = 0 extends 1 & T ? true : false;

type IsResultLike<T> = [T] extends [never]
	? false
	: [T] extends [Result<unknown, string>]
		? true
		: [T] extends [TryResult<unknown>]
			? true
			: false;

/** Wrapping something that already returns an outcome is a no-op worth flagging. */
type AsyncTryCallback<T> = IsResultLike<Awaited<T>> extends true ? never : T;

/**
 * Sync callbacks additionally reject promise returns. `tryResult` does not
 * await, so a promise-returning callback would have its rejection escape as an
 * unhandled rejection while the caller saw `{ ok: true }`. Making that a
 * compile error is the whole reason these two functions are separate.
 */
type SyncTryCallback<T> =
	IsAny<T> extends true
		? T
		: [T] extends [Promise<unknown>]
			? never
			: IsResultLike<T> extends true
				? never
				: T;

/**
 * Runs synchronous throwing code and returns the outcome as data.
 *
 * @example
 * const parsed = tryResult(() => JSON.parse(raw));
 * if (!parsed.ok) return err("malformed-payload", parsed.error);
 */
export function tryResult<T>(fn: () => SyncTryCallback<T>): TryResult<T>;
export function tryResult<T>(fn: () => T): TryResult<T> {
	try {
		return { ok: true, value: fn() };
	} catch (error) {
		return { ok: false, error: ensureError(error) };
	}
}

/**
 * Runs asynchronous throwing code and returns the outcome as data. Rejections
 * are normalized into `{ ok: false, error }`.
 *
 * Note `.catch()` on the returned promise observes nothing from `fn` — its
 * failures are in the resolved value. Use `.finally()` for cleanup.
 */
export async function tryAsyncResult<T>(
	fn: () => AsyncTryCallback<T> | Promise<AsyncTryCallback<T>>,
): Promise<TryResult<Awaited<T>>>;
export async function tryAsyncResult<T>(
	fn: () => T | Promise<T>,
): Promise<TryResult<Awaited<T>>> {
	try {
		return { ok: true, value: await fn() };
	} catch (error) {
		return { ok: false, error: ensureError(error) };
	}
}

/**
 * Unwraps a `TryResult`, rethrowing the error. For the top of a request or job
 * handler, where there is nothing left to branch on.
 */
export function unwrap<T>(result: TryResult<T>): T {
	if (result.ok) return result.value;
	throw result.error;
}
