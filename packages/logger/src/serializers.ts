import { errorChain, errorContext } from "@repo/utils/error";

export type SerializedError = {
	type: string;
	message: string;
	stack: string | undefined;
	context?: Record<string, unknown>;
	causes?: { type: string; message: string }[];
};

/**
 * Pino's default error serializer keeps `message` and `stack` but drops both
 * things this repo puts on an error: the `context` object from `createError`,
 * and everything below the first `cause`. Losing the cause chain is the
 * expensive one — the outermost message is usually the least specific.
 */
export function serializeError(error: unknown): SerializedError {
	const [outermost, ...causes] = errorChain(error);

	if (!outermost) {
		return { type: "Unknown", message: "Unknown error", stack: undefined };
	}

	const context = errorContext(outermost);

	return {
		type: outermost.name,
		message: outermost.message,
		stack: outermost.stack,
		...(context ? { context } : {}),
		...(causes.length > 0
			? {
					causes: causes.map((cause) => ({
						type: cause.name,
						message: cause.message,
					})),
				}
			: {}),
	};
}
