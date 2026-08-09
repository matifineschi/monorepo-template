import { env } from "./env";

/**
 * Next has no other server-start hook, so this is where env validation is
 * forced. Touching `env` is the entire point — do not remove the `void`.
 */
export async function register() {
	void env;
}
