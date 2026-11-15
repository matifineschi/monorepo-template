# @repo/email

Resend, and nothing else. Renders a React element to HTML and plain text,
sends it, retries what is worth retrying, and reports the outcome as a `Result`.
It has no templates and no opinion about what is sent — that is
`@repo/features/email`. Only `@repo/features` imports this package (apps may
import `@repo/email/env` for env composition), and only this package may
import `resend`; Biome enforces both.

## API

```ts
sendEmail({
	to: "ada@example.com",
	subject: "Welcome to Acme",
	react: <WelcomeEmail firstName="Ada" dashboardUrl={url} />,
	idempotencyKey: "welcome-user/<userId>",
	tags: [{ name: "category", value: "welcome" }],
}): Promise<Result<{ id: string }, "rejected" | "unavailable">>
```

- **Never throws for a delivery failure.** The caller decides whether a failed
  email fails its own work.
- **`"rejected"`** — a 4xx other than 429: unverified sender domain, restricted
  key, malformed address. Logged with Resend's message; not retried.
- **`"unavailable"`** — network errors, 5xx and 429 still failing after three
  attempts. Backoff is exponential with jitter, or exactly `retry-after` when
  Resend sends one (capped at 5s). Each attempt times out after 10s.
- **Idempotency keys** are `<event>/<entity-id>`; Resend drops a repeat within
  24 hours.

The transport is a parameter (`sendEmail(message, transport)`), so tests assert
on the rendered email without an account or a module mock. `resendTransport`
takes the SDK's `send` and a `sleep`, so the retry policy is tested against a
scripted sequence of responses.

## Environment

| Variable          | Required                   | Notes                                                                                    |
| ----------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `EMAIL_TRANSPORT` | no (default `log`)         | `log` renders and logs instead of sending; `resend` sends                                |
| `RESEND_API_KEY`  | when transport is `resend` | A **sending-access** key, restricted to your domain once verified. Boot fails without it |
| `EMAIL_FROM`      | yes, no default            | `Name <address>`. `onboarding@resend.dev` only delivers to the Resend account owner      |

## Going live

1. Create a sending-access key at https://resend.com/api-keys and set it as
   `RESEND_API_KEY` with `EMAIL_TRANSPORT=resend` in every app that sends
   (web, api, workers). Never a full-access key, never in git.
2. Verify a sending **subdomain** (e.g. `mail.example.com`) under
   https://resend.com/domains and add its DNS records, plus a DMARC record if the
   domain has none.
3. Switch `EMAIL_FROM` to an address on it, and restrict the key to that domain.

Before step 2, Resend only delivers mail from `onboarding@resend.dev` to your own
account address. `delivered@resend.dev` and `bounced@resend.dev` work as test
recipients with any key.
