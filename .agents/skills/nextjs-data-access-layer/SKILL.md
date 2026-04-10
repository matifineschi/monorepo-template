---
name: nextjs-data-access-layer
description: Use for Next.js app-router work that fetches or mutates protected data. Centralize reads/writes in a server-only Data Access Layer (DAL) with authorization, minimal DTOs, and request-scoped caching.
---

# Next.js Data Access Layer

Use this skill for **Next.js apps only**. It applies to app-router pages, layouts, server components, server actions, and route handlers.

## Trigger Policy

- Trigger when adding or refactoring data fetching in `apps/*/src/app/**`.
- Trigger when adding or refactoring server actions that read or mutate protected data.
- Trigger when the same data is fetched in multiple places in one request tree.
- Do not trigger for non-Next.js packages (workers, scripts, shared libraries without Next runtime).

## Required Outcomes

- Data access runs server-side only (`import "server-only"` in DAL modules).
- Authorization is centralized in DAL entrypoints.
- Call sites consume safe, minimal DTOs rather than raw full records where possible.
- Request-scoped deduplication uses `cache()` in DAL, not route-local helpers.
- Secret/env access stays in env/data boundary modules, not UI components.

## Repo Pattern

Create a dedicated DAL under `src/data`:

- `src/data/auth.ts`
- `src/data/<domain>.ts`

Keep pages/layouts/actions thin. They should call DAL functions, not repo/database methods directly.

## Good vs Bad

### Bad: direct repo access in page

```ts
// app/(protected)/applications/[applicationId]/summary/page.tsx
import { getCreditApplicationAggregate } from "@ume/database/credit-applications";

export default async function SummaryPage({ params }) {
  const { applicationId } = await params;
  const application = await getCreditApplicationAggregate(applicationId);
  // ...
}
```

### Good: page uses DAL

```ts
// app/(protected)/applications/[applicationId]/summary/page.tsx
import { findCreditApplication } from "~/data/credit-applications";
import { logger } from "@ume/logger";

export default async function SummaryPage({ params }) {
  const { applicationId } = await params;
  const application = await findCreditApplication(applicationId);
  if (!application) {
    logger.error({ applicationId }, "couldn't find application");
    throw new Error(`applicationId: ${applicationId} not found`);
  }
  // ...
}
```

### Bad: route-local cache helper

```ts
// app/.../get-credit-application-aggregate.ts
import { cache } from "react";
import { getCreditApplicationAggregate } from "@ume/database/credit-applications";

export const getCachedCreditApplicationAggregate = cache(async (id: string) => {
  return await getCreditApplicationAggregate(id);
});
```

### Good: centralized DAL + auth + cache

```ts
// src/data/credit-applications.ts
import "server-only";
import { cache } from "react";
import { getCreditApplicationAggregate } from "@ume/database/credit-applications";
import { getCurrentSession } from "./auth";

export const findCreditApplication = cache(async (applicationId: string) => {
  await getCurrentSession();
  return await getCreditApplicationAggregate(applicationId);
});
```

### Bad: server action bypasses DAL auth boundary

```ts
import { getCreditApplicationAggregate } from "@ume/database/credit-applications";

export async function someAction(applicationId: string) {
  const application = await getCreditApplicationAggregate(applicationId);
  // ...
}
```

### Good: server action calls the same DAL finder

```ts
import { findCreditApplication } from "~/data/credit-applications";

export async function someAction(applicationId: string) {
  const application = await findCreditApplication(applicationId);
  if (!application) {
    return { error: "Application not found" };
  }
  // ...
}
```

## Reference Implementation

- `apps/internal-portal/src/data/auth.ts`
- `apps/internal-portal/src/data/credit-applications.ts`

## Review Checklist

- No direct data repo imports in protected app pages/layouts/actions for covered domains.
- DAL modules include `server-only`.
- DAL functions enforce auth/session checks.
- Reused fetches are `cache()`-backed in DAL.
- Missing entity behavior is handled explicitly at the call site.
