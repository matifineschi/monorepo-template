---
name: form-action-state
description: Use whenever building forms in this repo. Route all form submits through server actions with useActionState (bind where needed) and Zod validation.
---

# Form Action State

Use one schema as the form contract, derive types from that schema, validate exactly once in the server action, and return schema-shaped errors to the client.

## Trigger Policy

- Trigger this skill for any request to build, update, or refactor a form, even if Zod or server actions are not explicitly mentioned.
- In this repo, form submission processing should use server actions plus `useActionState`.
- Use `bind` when actions require extra context arguments in addition to submitted form data.
- Zod validation is required for form payloads handled by server actions.

This is the canonical skill for both:

- Single-entity submissions (one record per submit)
- Multi-row list submissions keyed by client ID

## Pattern Selection

1. Use `references/single-form-pattern.md` when one entity is submitted per action.
2. Use `references/list-form-pattern.md` when multiple entries are submitted as a keyed collection.

## Shared Workflow

1. Define schema first as the validation source of truth.
2. Wire submit through a server action consumed by `useActionState` (use `bind` for extra action args).
3. Derive form/payload and error types from schema types.
4. Validate exactly once with `safeParse` in the action.
5. Return schema-derived errors and a generic form-level message on failure.
6. Persist from parsed output on success without a second parse pass.

## Pattern Rules

### Single-Entity Forms

- Schema shape: `z.object({...})`
- Error strategy: `z.flattenError(error).fieldErrors`
- Field names: `schema.keyof().enum`
- Client entry type: `z.input<typeof schema>`

Reference: `references/single-form-pattern.md`

### List/Multi-Row Forms

- Schema shape: `z.record(z.string(), entrySchema)`
- Error strategy: `z.treeifyError(error)`
- Row error access: `entryErrors?.properties?.[entry.clientId]?.properties`
- Row field names: `entrySchema.keyof().enum`
- DOM IDs must be row-unique (prefix/suffix with `clientId`)

Reference: `references/list-form-pattern.md`

## Guardrails

- Do not process final form payloads in client-only handlers when server actions are available.
- Do not duplicate schema validation rules in UI handlers.
- Do not define parallel types when schema-derived types are available.
- Do not parse the same payload multiple times.
- Do not manually parse error paths when flattened/treeified shapes already map to fields.
- Do not hard-code input names when schema key enums are available.
- Do not mix single/list error strategies.
