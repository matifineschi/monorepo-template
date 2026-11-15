import type { Queue } from "bullmq";

import type { DeleteFileJob, SendWelcomeEmailJob } from "@repo/queues";
import { createEmailQueue, createFileQueue } from "@repo/queues";

/**
 * Lazy producer singletons, shared by every feature that enqueues.
 *
 * Constructing a Queue opens a Redis connection, so building them at import
 * time would make every module that imports a feature require a live Redis —
 * including unit tests and the web app's pages that never enqueue anything.
 */
let email: Queue<SendWelcomeEmailJob> | null = null;
let files: Queue<DeleteFileJob> | null = null;

export function emailQueue(): Queue<SendWelcomeEmailJob> {
	email ??= createEmailQueue();
	return email;
}

export function fileQueue(): Queue<DeleteFileJob> {
	files ??= createFileQueue();
	return files;
}

/** Closes any queue this process opened. Called from each app's shutdown path. */
export async function closeQueues(): Promise<void> {
	await Promise.all([email?.close(), files?.close()]);
	email = null;
	files = null;
}
