---
name: nextjs-data-access-layer
description: Use for Next.js app-router work that fetches or mutates protected data. Centralize reads/writes in a server-only Data Access Layer (DAL) with authorization, minimal DTOs, and request-scoped caching.
---

# Next.js Data Access Layer

Use this skill for **Next.js apps only**. It applies to app-router pages, layouts, server components, server actions, and route handlers.

## Trigger Policy

- Trigger when adding or refactoring data fetching in `apps/web/app/**`.
- Trigger when adding or refactoring server actions that read or mutate protected data.
- Trigger when the same data is fetched in multiple places in one request tree.
- Do not trigger for non-Next.js workspaces (the Hono API, the workers, or shared packages with no Next runtime).

## Required Outcomes

- Data access runs server-side only (`import "server-only"` in DAL modules).
- Authorization is centralized in DAL entrypoints.
- Call sites consume safe, minimal DTOs rather than raw full records where possible.
- Request-scoped deduplication uses `cache()` in the DAL, not route-local helpers.
- Secret/env access stays in `env.ts` and the DAL, not in UI components.

## Repo Pattern

Create a dedicated DAL under `apps/web/lib/data`, reached through the `@/` alias:

- `apps/web/lib/data/auth.ts`
- `apps/web/lib/data/<domain>.ts`

Keep pages, layouts and actions thin. They call DAL functions, never
`@repo/db/operations/*` directly — the operations layer is the database's
public surface, and the DAL is where the session check lives.

## Good vs Bad

### Bad: direct operations access in a page

```ts
// app/(dashboard)/files/[fileId]/page.tsx
import { getFileById } from "@repo/db/operations/files";

export default async function FilePage({ params }) {
  const { fileId } = await params;
  const file = await getFileById(fileId);
  // ...
}
```

Nothing here checks who is asking.

### Good: page uses the DAL

```ts
// app/(dashboard)/files/[fileId]/page.tsx
import { logger } from "@repo/logger";

import { findFile } from "@/lib/data/files";

export default async function FilePage({ params }) {
  const { fileId } = await params;
  const file = await findFile(fileId);
  if (!file) {
    logger.warn({ fileId }, "File not found for the current session");
    notFound();
  }
  // ...
}
```

### Bad: route-local cache helper

```ts
// app/.../get-file.ts
import { cache } from "react";
import { getFileById } from "@repo/db/operations/files";

export const getCachedFile = cache(async (id: string) => {
  return await getFileById(id);
});
```

A second route that needs the same row writes its own copy of this, and the
two drift on whether they check the session.

### Good: centralized DAL with auth and cache

```ts
// apps/web/lib/data/files.ts
import "server-only";

import { cache } from "react";
import { getFileById } from "@repo/db/operations/files";

import { requireSession } from "./auth";

export const findFile = cache(async (fileId: string) => {
  const session = await requireSession();
  const file = await getFileById(fileId);
  // Ownership is checked here, once, rather than at each call site.
  return file?.userId === session.user.id ? file : null;
});
```

### Bad: server action bypasses the DAL auth boundary

```ts
import { getFileById } from "@repo/db/operations/files";

export async function deleteFileAction(fileId: string) {
  const file = await getFileById(fileId);
  // ...
}
```

A server action is a public HTTP endpoint. This one takes an id from the
browser and reads whatever it names.

### Good: server action calls the same DAL finder

```ts
import { findFile } from "@/lib/data/files";

export async function deleteFileAction(fileId: string) {
  const file = await findFile(fileId);
  if (!file) {
    return { error: "File not found" };
  }
  // ...
}
```

## Reference Implementation

This template ships no DAL yet — `apps/web` reads the session directly through
`@repo/auth` because it has no protected domain data of its own. The shape above
is what to create on the first page that does.

The pieces it builds on already exist:

- `@repo/db/operations/*` — the database's public surface, one module per domain.
- `apps/web/lib/auth-client.ts` — the browser-side auth barrel, and the
  precedent for putting app-level modules in `apps/web/lib`.
- `@repo/db/transaction` — for a DAL writer that needs several operations to
  commit together.

## Review Checklist

- No `@repo/db/operations/*` imports in protected app pages, layouts or actions.
- DAL modules include `server-only`.
- DAL functions enforce the session check, and ownership where the row has an owner.
- Reused fetches are `cache()`-backed in the DAL.
- Missing-entity behavior is handled explicitly at the call site.
