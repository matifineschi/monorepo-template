import pino, { type Logger } from "pino";
import pretty from "pino-pretty";

import { baseEnv } from "@repo/env/base";

import { loggerEnv } from "./env";
import { serializeError } from "./serializers";

/**
 * Paths pino replaces with `[Redacted]` before anything is written.
 *
 * This is a backstop, not a licence to log credentials — it only covers the
 * exact paths listed, so a secret nested somewhere unanticipated still gets
 * through. The rule remains: do not pass a request body, a header bag, or an
 * env object to the logger.
 */
const REDACTED_PATHS = [
	"password",
	"token",
	"secret",
	"authorization",
	"cookie",
	"*.password",
	"*.token",
	"*.secret",
	"*.authorization",
	"*.cookie",
	"req.headers.authorization",
	"req.headers.cookie",
	"headers.authorization",
	"headers.cookie",
];

const options = {
	level: loggerEnv.LOG_LEVEL,
	redact: { paths: REDACTED_PATHS, censor: "[Redacted]" },
	serializers: { err: serializeError, error: serializeError },
	// Pino's default is epoch millis; ISO is what every log viewer expects.
	timestamp: pino.stdTimeFunctions.isoTime,
} as const;

/**
 * Pretty output is wired as a *stream*, not a pino `transport`. A transport
 * runs in a worker thread, which on Bun means the process can exit with lines
 * still buffered — the last thing a crashing worker logged is exactly the line
 * you need. The stream is synchronous and always flushed.
 */
function createLogger(): Logger {
	if (baseEnv.NODE_ENV === "production") {
		return pino(options);
	}

	return pino(
		options,
		pretty({ colorize: true, sync: true, ignore: "pid,hostname" }),
	);
}

/**
 * The repo's logger. Server-side only: it is Node/Bun pino, and importing it
 * into a client component pulls the whole thing into the browser bundle.
 *
 * Pass structured fields, not interpolated strings — `logger.info({ userId },
 * "User provisioned")` rather than `logger.info(\`provisioned ${userId}\`)`. The
 * first is filterable; the second is a haystack.
 */
export const logger = createLogger();

/**
 * A logger tagged with fields every line from one component should carry.
 *
 * @example
 * const log = childLogger({ worker: "email" });
 */
export function childLogger(bindings: Record<string, unknown>): Logger {
	return logger.child(bindings);
}

export type { Logger } from "pino";

export type { SerializedError } from "./serializers";
export { serializeError } from "./serializers";
