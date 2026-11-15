import type { Session } from "@repo/features/auth";

export type AppVariables = {
	user: Session["user"] | null;
	session: Session["session"] | null;
};
