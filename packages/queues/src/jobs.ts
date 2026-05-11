export type SendWelcomeEmailJob = {
	type: "send-welcome-email";
	userId: string;
	email: string;
	name: string;
};

export type JobPayload = SendWelcomeEmailJob;

export const QUEUE_NAMES = {
	email: "email",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
