import { Hono } from "hono";
import type { AppVariables } from "../lib/types";

export const meRoutes = new Hono<{ Variables: AppVariables }>();

meRoutes.get("/", (c) => {
	const user = c.get("user");

	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	return c.json({
		user,
		session: c.get("session"),
	});
});
