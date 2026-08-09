import type { DeleteFileJob } from "@repo/queues";
import { createFileQueue } from "@repo/queues";
import type { Queue } from "bullmq";

/**
 * Lazy singletons. Constructing a Queue opens a Redis connection, so building
 * them at import time would make every route module require a live Redis —
 * including in unit tests that never enqueue anything.
 */
let files: Queue<DeleteFileJob> | null = null;

export function fileQueue(): Queue<DeleteFileJob> {
	if (!files) files = createFileQueue();
	return files;
}

/** Closes any queue this process opened. Called from the shutdown path. */
export async function closeQueues(): Promise<void> {
	await files?.close();
	files = null;
}
