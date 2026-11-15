/**
 * Object-key derivation and ownership.
 *
 * There is no database table recording uploads, so the key prefix IS the
 * ownership record: `uploads/<userId>/<uuid><ext>`. Everything here exists to
 * keep that invariant true.
 *
 * Never build a key from a client-supplied string. A caller who chooses their
 * own key can read or delete any other user's objects — this module is the only
 * thing standing between a request and that. Routes derive keys with
 * `uploadKey`, list with `userPrefix`, and gate every key-taking operation on
 * `isOwnedBy`.
 */

/** Extensions we hand back in a derived key. Anything else becomes `.bin`. */
const ALLOWED_EXTENSIONS = new Set([
	"avif",
	"csv",
	"gif",
	"jpeg",
	"jpg",
	"json",
	"md",
	"mp4",
	"pdf",
	"png",
	"svg",
	"txt",
	"webp",
	"webm",
	"zip",
]);

const UPLOAD_ROOT = "uploads";

/**
 * The trailing slash is load-bearing: without it `uploads/user-1` is a prefix of
 * `uploads/user-10/secret.png`, and one user could list another's objects.
 */
export function userPrefix(userId: string): string {
	if (!isSafeSegment(userId)) {
		throw new Error(
			"Refusing to build a storage prefix from an unsafe user id",
		);
	}
	return `${UPLOAD_ROOT}/${userId}/`;
}

/**
 * Derives a collision-free key under the user's prefix. The original filename
 * only ever contributes an extension — never a path segment, never the name.
 */
export function uploadKey(userId: string, filename: string): string {
	return `${userPrefix(userId)}${crypto.randomUUID()}${extensionOf(filename)}`;
}

/** True when `key` sits under this user's prefix. */
export function isOwnedBy(key: string, userId: string): boolean {
	if (!key || !isSafeSegment(userId)) return false;
	// A key containing traversal or a leading slash is never one we issued.
	if (key.startsWith("/") || key.includes("..") || key.includes("\0")) {
		return false;
	}
	const prefix = `${UPLOAD_ROOT}/${userId}/`;
	if (!key.startsWith(prefix)) return false;
	// Reject a bare prefix with no object name after it.
	return key.length > prefix.length;
}

/** Normalized `.ext` for a filename, or `.bin` when it isn't one we allow. */
function extensionOf(filename: string): string {
	const lastDot = filename.lastIndexOf(".");
	if (lastDot < 0) return ".bin";

	const candidate = filename
		.slice(lastDot + 1)
		.trim()
		.toLowerCase();

	// Anything non-alphanumeric here means the "extension" carried a path
	// separator, a null byte, or a query string — not an extension.
	if (!/^[a-z0-9]+$/.test(candidate)) return ".bin";

	return ALLOWED_EXTENSIONS.has(candidate) ? `.${candidate}` : ".bin";
}

/** User ids come from the session, but a bad one must not escape the prefix. */
function isSafeSegment(value: string): boolean {
	return /^[A-Za-z0-9._-]+$/.test(value) && !value.includes("..");
}
