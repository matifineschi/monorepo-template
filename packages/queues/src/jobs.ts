export type SendWelcomeEmailJob = {
	type: "send-welcome-email";
	userId: string;
	email: string;
	name: string;
};

/** Removes a bucket object. Enqueued by the API after it drops its reference. */
export type DeleteFileJob = {
	type: "delete-file";
	key: string;
};

export type JobPayload = SendWelcomeEmailJob | DeleteFileJob;

/**
 * Queue names are persisted inside Redis keys. Renaming one orphans every job
 * already enqueued under the old name, so always reference this constant rather
 * than writing the string literal at a call site.
 */
export const QUEUE_NAMES = {
	email: "email",
	files: "files",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
