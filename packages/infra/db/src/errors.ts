import { createError } from "@repo/utils/error";

/**
 * Postgres error codes, for the handful of failures that are a caller's
 * business rather than an outage.
 *
 * Drizzle wraps the driver error, and `postgres`-js puts the code on its own
 * error object, so the code is somewhere down the `cause` chain rather than on
 * the error you catch. Everything here walks that chain.
 *
 * Full list: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_ERROR_CODES = {
	uniqueViolation: "23505",
	foreignKeyViolation: "23503",
	notNullViolation: "23502",
	checkViolation: "23514",
	/** Usually a malformed uuid reaching a uuid column. */
	invalidTextRepresentation: "22P02",
	serializationFailure: "40001",
	deadlockDetected: "40P01",
	connectionFailure: "08006",
} as const;

export type PgErrorCode = (typeof PG_ERROR_CODES)[keyof typeof PG_ERROR_CODES];

type PgErrorShape = {
	code?: unknown;
	constraint_name?: unknown;
	constraint?: unknown;
	table_name?: unknown;
	table?: unknown;
	column_name?: unknown;
	column?: unknown;
	detail?: unknown;
};

export type DbErrorDetails = {
	code: string | null;
	constraint: string | null;
	table: string | null;
	column: string | null;
};

const MAX_CAUSE_DEPTH = 10;

function asString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Finds the driver error in the cause chain. Depth-capped and cycle-guarded:
 * nothing stops `a.cause = b; b.cause = a`.
 */
function findPgError(error: unknown): PgErrorShape | null {
	const seen = new Set<unknown>();
	let current: unknown = error;

	for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
		if (!current || typeof current !== "object" || seen.has(current)) break;
		seen.add(current);

		if (asString((current as PgErrorShape).code)) {
			return current as PgErrorShape;
		}
		current = (current as { cause?: unknown }).cause;
	}

	return null;
}

/** The driver's code, constraint, table and column, or nulls if it isn't a pg error. */
export function dbErrorDetails(error: unknown): DbErrorDetails {
	const pgError = findPgError(error);
	if (!pgError) {
		return { code: null, constraint: null, table: null, column: null };
	}

	return {
		code: asString(pgError.code),
		constraint:
			asString(pgError.constraint_name) ?? asString(pgError.constraint),
		table: asString(pgError.table_name) ?? asString(pgError.table),
		column: asString(pgError.column_name) ?? asString(pgError.column),
	};
}

export function dbErrorCode(error: unknown): string | null {
	return dbErrorDetails(error).code;
}

/**
 * A duplicate row. The usual reason a sign-up or a rename fails for a reason
 * the caller can act on, rather than one they can only be told about.
 *
 * Pass `constraint` to check for a specific one — a table with two unique
 * indexes otherwise reports "already taken" for whichever one it was.
 *
 * @example
 * const saved = await tryAsyncResult(() => createUser(input));
 * if (!saved.ok) {
 *   if (isUniqueViolation(saved.error, "users_email_key")) return err("email-taken");
 *   throw saved.error;
 * }
 */
export function isUniqueViolation(
	error: unknown,
	constraint?: string,
): boolean {
	const details = dbErrorDetails(error);
	if (details.code !== PG_ERROR_CODES.uniqueViolation) return false;
	return constraint === undefined || details.constraint === constraint;
}

export function isForeignKeyViolation(
	error: unknown,
	constraint?: string,
): boolean {
	const details = dbErrorDetails(error);
	if (details.code !== PG_ERROR_CODES.foreignKeyViolation) return false;
	return constraint === undefined || details.constraint === constraint;
}

export function isNotNullViolation(error: unknown, column?: string): boolean {
	const details = dbErrorDetails(error);
	if (details.code !== PG_ERROR_CODES.notNullViolation) return false;
	return column === undefined || details.column === column;
}

export function isCheckViolation(error: unknown, constraint?: string): boolean {
	const details = dbErrorDetails(error);
	if (details.code !== PG_ERROR_CODES.checkViolation) return false;
	return constraint === undefined || details.constraint === constraint;
}

/**
 * True when retrying the whole transaction is the correct response: Postgres
 * aborted it to resolve a conflict with a concurrent one, and the same
 * statements may well succeed on a second attempt.
 */
export function isRetryableTransactionError(error: unknown): boolean {
	const code = dbErrorCode(error);
	return (
		code === PG_ERROR_CODES.serializationFailure ||
		code === PG_ERROR_CODES.deadlockDetected
	);
}

/**
 * Re-raises a driver error with the pg metadata promoted into `context`, so a
 * log line says which constraint failed instead of just "insert failed".
 */
export function asDbError(message: string, error: unknown): Error {
	return createError(message, {
		cause: error,
		context: { db: dbErrorDetails(error) },
	});
}
