import type { MiddlewareHandler } from "hono";

import { childLogger } from "@repo/logger";

const log = childLogger({ component: "http" });

/**
 * One structured line per request.
 *
 * Replaces `hono/logger`, which writes a formatted string. A string has to be
 * parsed back apart before anything can filter on it; these fields can be
 * queried directly ("every 5xx on /files over 500ms").
 *
 * The query string is deliberately not logged: it is the easiest place for a
 * token or an email address to end up in a log aggregator.
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
	const startedAt = performance.now();

	await next();

	const durationMs = Math.round(performance.now() - startedAt);
	const fields = {
		method: c.req.method,
		path: c.req.path,
		status: c.res.status,
		durationMs,
	};

	if (c.res.status >= 500) {
		log.error(fields, "Request failed");
		return;
	}
	if (c.res.status >= 400) {
		log.warn(fields, "Request rejected");
		return;
	}
	log.info(fields, "Request completed");
};
