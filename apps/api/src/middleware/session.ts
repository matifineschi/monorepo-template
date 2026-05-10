import { auth } from "@repo/auth";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../lib/types";

export const sessionMiddleware: MiddlewareHandler<{
	Variables: AppVariables;
}> = async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		c.set("user", null);
		c.set("session", null);
		await next();
		return;
	}

	c.set("user", session.user);
	c.set("session", session.session);
	await next();
};
