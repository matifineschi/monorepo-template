# @repo/features

The business logic. Every app calls this package; no app imports
`packages/infra/*` directly. Read
[docs/architecture.md](../../docs/architecture.md) for the full boundary rules.

## Modules

Each module is its own subpath. There is no root export, so a worker that only
deletes files never loads auth or needs `DATABASE_URL`.

| Import                  | Use it for                                                                                                 | Talks to                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------- |
| `@repo/features/auth`   | `authHandler`, `getSession`, `signInWithEmail`, `signUpWithEmail`, `requestPasswordReset`, `resetPassword` | auth, db, email, queues |
| `@repo/features/users`  | `provisionUser`, `getUserProfile`, `findAccountByEmail`, `deleteAccount`, `getNameParts`                   | db                      |
| `@repo/features/email`  | `sendPasswordResetEmail`, `sendWelcomeEmail`, `enqueueWelcomeEmail`, `processEmailJob`                     | email, queues           |
| `@repo/features/files`  | `uploadUrlSchema`, `createUserUploadUrl`, `listUserFiles`, `requestFileDeletion`, `processFileJob`         | storage, queues         |
| `@repo/features/system` | `checkReadiness`, `closeFeatureConnections`                                                                | db, queues, storage     |

## Layout

```
src/
  auth/          the better-auth instance and its hooks; sign-in/up, reset
  users/         provisioning, profile reads, account deletion, the naming rule
  email/
    templates/   one React Email file per email (default export, for the preview)
    components/  EmailLayout, EmailHeading, EmailText, EmailButton
    theme.ts     emailTheme: the Astryx theme resolved into email-safe values
    messages.tsx what each email says, its idempotency key, the queue job body
  files/         upload rules, key policy (keys.ts), list/presign/delete
  system/        readiness and shutdown
  shared/        lazy queue producers
tests/integration/   against the test stack: own database + queue prefix
```

## Conventions

- **Database only through `@repo/db/operations/*`** and `withTransaction`.
- **Expected failures are `Result`s with domain codes.** Library errors
  (better-auth's `USER_ALREADY_EXISTS`, a Resend 403) are translated here and
  never reach an app.
- **Side effects are injectable**, as an optional last parameter defaulting to
  the real one: `processEmailJob(data, deliver = sendEmail)`,
  `processFileJob(data, remove = deleteObject)`. Tests pass recorders; there is
  no module mocking.
- **Job bodies live here**; `apps/workers` only wires them to BullMQ. A job body
  throws only for failures worth a retry.
- **Nothing opens a connection at import time.** Queue producers are lazy
  (`src/shared/queues.ts`); call `closeFeatureConnections()` on shutdown.

## Email templates and the design system

Templates must look like the app, but Astryx components can't render in an
email client. So templates use `react-email` primitives through the components
in `src/email/components/`, styled **only** from `emailTheme`. That object is
Astryx's own `resolveThemeTokens` run over `@repo/ui/theme` (the theme the web
app mounts), with rem converted to px and 8-digit hex to `rgba()`.

- No hex, px or font literal in a template or component. Add the token to
  `emailTheme` instead.
- `src/email/__tests__/theme.test.ts` fails if a value is left unresolved.

Adding an email: a template in `templates/` (default export plus
`PreviewProps`), a `sendXEmail(input, deliver = sendEmail)` in `messages.tsx`
with an `<event>/<id>` idempotency key, export it from `email/index.ts`, and a
unit test with a recording `deliver`.

## Commands

| Command                    | What it does                                            |
| -------------------------- | ------------------------------------------------------- |
| `bun run test`             | Unit tests — no docker                                  |
| `bun run test:integration` | Account lifecycle against the test stack                |
| `bun run email:dev`        | React Email preview of every template at localhost:3030 |
| `bun run typecheck`        | `tsc --noEmit`                                          |
