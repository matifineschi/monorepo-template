import { db, schema } from "../client";

type PublicUserProvisionInput = {
	id: string;
	name?: string | null;
	email?: string | null;
};

function getNameParts(
	input: Pick<PublicUserProvisionInput, "email" | "name">,
): {
	firstName: string;
	lastName: string;
} {
	const trimmedName = input.name?.trim();
	const fallbackFromEmail = input.email?.split("@")[0]?.trim();
	const normalized = trimmedName || fallbackFromEmail || "User";
	const [firstName, ...rest] = normalized.split(/\s+/).filter(Boolean);

	return {
		firstName: firstName || "User",
		lastName: rest.join(" ") || "User",
	};
}

export async function createUser(
	input: PublicUserProvisionInput,
): Promise<{ created: boolean }> {
	const { firstName, lastName } = getNameParts(input);

	const [createdUser] = await db
		.insert(schema.users)
		.values({
			id: input.id,
			firstName,
			lastName,
		})
		.onConflictDoNothing({ target: schema.users.id })
		.returning({
			id: schema.users.id,
		});

	return { created: Boolean(createdUser?.id) };
}
