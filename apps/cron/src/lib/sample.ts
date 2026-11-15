/**
 * Reservoir sampling for the backup check. Pure — nothing here reads env —
 * so the draw is covered by unit tests.
 */

/**
 * rclone's `--files-from` is a newline-delimited list, so a key containing a
 * newline or carriage return cannot be expressed in one — the entry would split
 * and the check would silently verify different objects than it reported.
 *
 * S3 permits such keys. `uploadKey` never produces one (uuid plus a normalised
 * extension), so this cannot trigger for objects this template wrote; it is
 * here so a bucket holding keys from somewhere else degrades loudly instead of
 * quietly checking the wrong thing.
 */
export function isFilesFromSafe(path: string): boolean {
	return !/[\r\n]/.test(path);
}

/**
 * Reservoir sampling: `size` items picked uniformly from a stream of unknown
 * length, holding only the sample in memory. Uniform matters because objects
 * are listed in key order — the first N would only ever check one corner.
 */
export function createReservoir<T>(size: number) {
	const items: T[] = [];
	let seen = 0;

	return {
		offer(item: T): void {
			seen += 1;
			if (items.length < size) {
				items.push(item);
				return;
			}
			const index = Math.floor(Math.random() * seen);
			if (index < size) items[index] = item;
		},
		get sample(): readonly T[] {
			return items;
		},
		get seen(): number {
			return seen;
		},
	};
}
