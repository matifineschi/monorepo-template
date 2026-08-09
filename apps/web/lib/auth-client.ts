/**
 * App-level barrel for the better-auth browser client. App code imports from
 * here rather than reaching into `@repo/auth/client` directly.
 *
 * Only `signOut` has a caller today; the others are deliberate scaffolding for
 * anyone building on this template, so the whole barrel carries the tag knip is
 * configured to skip (`tags: ["-lintignore"]` in knip.json).
 *
 * @lintignore
 */
export { authClient, signIn, signOut, signUp, useSession } from "@repo/auth/client";
