/**
 * Decides what every new user is called. better-auth hands over whatever the
 * sign-up form produced, so `name` may be absent, blank or a single word, and
 * every branch here is a fallback for a case it can actually produce.
 */
export function getNameParts(input: {
	name?: string | null;
	email?: string | null;
}): {
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

/** The display name a sign-up gets when the form asks only for an email. */
export function displayNameFromEmail(email: string): string {
	return email.split("@")[0] || "User";
}
