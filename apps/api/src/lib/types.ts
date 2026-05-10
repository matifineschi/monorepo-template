import type { auth } from "@repo/auth";

type AuthSession = typeof auth.$Infer.Session;

export type AppVariables = {
	user: AuthSession["user"] | null;
	session: AuthSession["session"] | null;
};
