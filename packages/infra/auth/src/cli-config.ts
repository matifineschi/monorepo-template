import { createAuth } from "./auth";

/**
 * For better-auth's CLI only (`gen:schema`), which needs a module exporting an
 * `auth` instance. Hooks don't affect the generated schema, so none are wired.
 * The application's instance lives in `@repo/features/auth`.
 */
export const auth = createAuth();
