import { afterAll, describe, expect, test } from "bun:test";

import { createEmailQueue } from "@repo/queues";

import { signUpWithEmail } from "../../src/auth";
import { closeFeatureConnections } from "../../src/system";
import {
	deleteAccount,
	findAccountByEmail,
	getUserProfile,
	provisionUser,
} from "../../src/users";

/**
 * The account lifecycle through the features layer only, against the real
 * database and Redis of the test stack: sign-up (with its provisioning and
 * welcome-email hooks), idempotent provisioning, and deletion.
 */
const PASSWORD = "correct-horse-battery-staple";
const emailQueue = createEmailQueue();

afterAll(async () => {
	await emailQueue.obliterate({ force: true });
	await emailQueue.close();
	await closeFeatureConnections();
});

async function signUp(email: string, name: string) {
	const result = await signUpWithEmail(
		{ email, password: PASSWORD, name },
		new Headers(),
	);
	const account = await findAccountByEmail(email);
	return { result, account };
}

describe("signUpWithEmail", () => {
	test("creates the account, its profile and a welcome job", async () => {
		const { result, account } = await signUp(
			"lifecycle@example.test",
			"Ada Lovelace",
		);

		expect(result.ok).toBe(true);
		expect(account).not.toBeNull();
		const id = account?.id as string;

		expect(await getUserProfile(id)).toMatchObject({
			firstName: "Ada",
			lastName: "Lovelace",
		});
		expect((await emailQueue.getJob(`welcome-${id}`))?.data).toMatchObject({
			type: "send-welcome-email",
			userId: id,
			email: "lifecycle@example.test",
		});
	});

	test("maps a duplicate address to email-taken", async () => {
		await signUp("taken@example.test", "Ada");

		const { result } = await signUp("taken@example.test", "Ada Again");

		expect(result).toEqual({ ok: false, code: "email-taken" });
	});
});

describe("provisionUser", () => {
	/**
	 * better-auth's user.create.after hook can fire twice for one id across
	 * retries; the second call must be a no-op, not a duplicate-key error.
	 */
	test("is idempotent", async () => {
		const { account } = await signUp("idempotent@example.test", "Grace Hopper");
		const user = account as NonNullable<typeof account>;

		expect(await provisionUser(user)).toEqual({ created: false });
		expect((await getUserProfile(user.id))?.firstName).toBe("Grace");
	});
});

describe("deleteAccount", () => {
	test("removes both the profile and the account", async () => {
		const { account } = await signUp("delete-me@example.test", "Alan Turing");
		const id = account?.id as string;

		await deleteAccount(id);

		expect(await getUserProfile(id)).toBeNull();
		expect(await findAccountByEmail("delete-me@example.test")).toBeNull();
	});
});
