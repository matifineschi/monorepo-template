import { eq } from "drizzle-orm";

import { db, schema } from "../client";

export async function getAuthUserById(userId: string): Promise<{
	id: string;
	name: string;
	email: string | null;
} | null> {
	const [user] = await db
		.select({
			id: schema.userAuthUsers.id,
			name: schema.userAuthUsers.name,
			email: schema.userAuthUsers.email,
		})
		.from(schema.userAuthUsers)
		.where(eq(schema.userAuthUsers.id, userId))
		.limit(1);

	return user ?? null;
}
