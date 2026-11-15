import { describe, expect, test } from "bun:test";

import { createElement } from "react";
import type { Resend } from "resend";

import type { RenderedEmail } from "../send";
import { resendTransport, sendEmail } from "../send";

type ResendSend = Resend["emails"]["send"];
type SendResponse = Awaited<ReturnType<ResendSend>>;

function success(id: string): SendResponse {
	return { data: { id }, error: null, headers: null };
}

function failure(
	statusCode: number | null,
	headers: Record<string, string> | null = null,
): SendResponse {
	return {
		data: null,
		error: { message: "nope", name: "application_error", statusCode },
		headers,
	};
}

/** Plays back `responses` in order and records every request it was given. */
function scripted(responses: SendResponse[]) {
	const calls: Parameters<ResendSend>[] = [];
	const send = (async (...args: Parameters<ResendSend>) => {
		calls.push(args);
		const next = responses.shift();
		if (!next) throw new Error("no scripted response left");
		return next;
	}) as ResendSend;
	return { calls, send };
}

const sleeps: number[] = [];
const noSleep = async (ms: number) => {
	sleeps.push(ms);
};

const email: RenderedEmail = {
	from: "Acme <onboarding@resend.dev>",
	to: "delivered@resend.dev",
	subject: "Hello",
	html: "<p>Hello</p>",
	text: "Hello",
	idempotencyKey: "welcome-user/1",
};

describe("sendEmail", () => {
	test("renders the component to html and text before handing it over", async () => {
		const seen: RenderedEmail[] = [];

		const result = await sendEmail(
			{
				to: "ada@example.test",
				subject: "Hi",
				react: createElement("p", null, "Hello Ada"),
				idempotencyKey: "test/1",
			},
			async (rendered) => {
				seen.push(rendered);
				return { ok: true, value: { id: "1" } };
			},
		);

		expect(result.ok).toBe(true);
		expect(seen[0]?.html).toContain("Hello Ada");
		expect(seen[0]?.text).toContain("Hello Ada");
		expect(seen[0]?.from).toBe("Acme <onboarding@resend.dev>");
		expect(seen[0]?.idempotencyKey).toBe("test/1");
	});
});

describe("resendTransport", () => {
	test("passes the idempotency key as a request option", async () => {
		const { calls, send } = scripted([success("em_1")]);

		const result = await resendTransport(send, noSleep)(email);

		expect(result).toEqual({ ok: true, value: { id: "em_1" } });
		expect(calls[0]?.[1]).toEqual({ idempotencyKey: "welcome-user/1" });
		expect(calls[0]?.[0]).toMatchObject({ html: "<p>Hello</p>" });
	});

	test("retries a 5xx and then succeeds", async () => {
		const { calls, send } = scripted([failure(503), success("em_2")]);

		const result = await resendTransport(send, noSleep)(email);

		expect(result.ok).toBe(true);
		expect(calls).toHaveLength(2);
	});

	test("waits as long as a 429's retry-after asks", async () => {
		sleeps.length = 0;
		const { send } = scripted([
			failure(429, { "retry-after": "1" }),
			success("em_3"),
		]);

		await resendTransport(send, noSleep)(email);

		expect(sleeps).toEqual([1000]);
	});

	test("does not retry a 4xx and reports it as rejected", async () => {
		const { calls, send } = scripted([failure(403)]);

		const result = await resendTransport(send, noSleep)(email);

		expect(result).toEqual({ ok: false, code: "rejected" });
		expect(calls).toHaveLength(1);
	});

	test("gives up as unavailable after three transient failures", async () => {
		const { calls, send } = scripted([
			failure(null),
			failure(500),
			failure(502),
		]);

		const result = await resendTransport(send, noSleep)(email);

		expect(result).toEqual({ ok: false, code: "unavailable" });
		expect(calls).toHaveLength(3);
	});
});
