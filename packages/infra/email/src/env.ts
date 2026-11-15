import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { shouldSkipEnvValidation } from "@repo/env";

export const emailEnv = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		/**
		 * `log` renders every email and writes it to the logger instead of
		 * sending it, so a fresh clone and the test suites need no Resend account.
		 * A deployed environment sets `resend`.
		 */
		EMAIL_TRANSPORT: z.enum(["resend", "log"]).default("log"),
		/**
		 * A *sending-access* key, restricted to the sending domain once one is
		 * verified. Never a full-access key: the app only ever sends.
		 */
		RESEND_API_KEY: z.string().startsWith("re_").optional(),
		/**
		 * `Name <address>`. Required with no default: a fallback sender would
		 * silently ship the Resend test address (`onboarding@resend.dev`, which
		 * only delivers to the account owner) to production.
		 */
		EMAIL_FROM: z.string().min(1),
	},
	/** A `resend` transport without a key must fail at boot, not on first send. */
	createFinalSchema: (shape) =>
		z.object(shape).superRefine((value, ctx) => {
			if (value.EMAIL_TRANSPORT === "resend" && !value.RESEND_API_KEY) {
				ctx.addIssue({
					code: "custom",
					message: "RESEND_API_KEY is required when EMAIL_TRANSPORT=resend",
					path: ["RESEND_API_KEY"],
				});
			}
		}),
	skipValidation: shouldSkipEnvValidation(),
});
