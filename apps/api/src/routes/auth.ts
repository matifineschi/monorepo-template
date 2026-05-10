import { auth } from "@repo/auth";
import { Hono } from "hono";

export const authRoutes = new Hono();

authRoutes.on(["GET", "POST"], "/*", (c) => {
	return auth.handler(c.req.raw);
});
