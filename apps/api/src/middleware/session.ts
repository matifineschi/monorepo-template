import type { MiddlewareHandler } from "hono";

import { getSession } from "@repo/features/auth";

import type { AppVariables } from "../lib/types";

export const sessionMiddleware: MiddlewareHandler<{
	Variables: AppVariables;
}> = async (c, next) => {
	const session = await getSession(c.req.raw.headers);

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
