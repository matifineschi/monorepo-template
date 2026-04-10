# List Form Pattern

Use this pattern for dynamic form rows keyed by `clientId`, validated by one Zod schema, and surfaced via treeified errors.

## Schema and Action State

```ts
import { z } from "zod";
import type { $ZodErrorTree } from "zod/v4/core";

const entrySchema = z.object({
  employmentId: z.string().optional(),
  companyName: z.string().trim().min(2, "Business name is required"),
  occupation: z.string().trim().min(2, "Occupation is required"),
  basis: z
    .enum(["Full Time", "Part Time"])
    .optional()
    .refine((v) => v != null, "Please select an employment basis"),
  employmentYears: z.coerce
    .number()
    .transform((v) => Math.max(Math.floor(v), 0)),
  employmentMonths: z.coerce
    .number()
    .transform((v) => Math.max(Math.floor(v), 0)),
  netSalaryAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid income amount"),
  netSalaryFrequency: z
    .enum(["Weekly", "Fortnightly", "Monthly", "Yearly"])
    .optional()
    .refine((v) => v != null, "Please select a frequency"),
});

const payloadSchema = z.record(z.string(), entrySchema);
const Field = entrySchema.keyof().enum;

type Payload = z.infer<typeof payloadSchema>;
type PayloadEntry = Payload[string];

type ActionState = {
  entryErrors?: $ZodErrorTree<Payload>;
  error?: string;
  success?: boolean;
};
```

## Action Parse and Error Return

```ts
const result = payloadSchema.safeParse(payload);
if (!result.success) {
  return {
    entryErrors: z.treeifyError(result.error),
    error: "Please complete all required fields",
  };
}
```

## Client Payload and Error Access

```ts
type Entry = PayloadEntry & {
  clientId: string;
};

const payload = Object.fromEntries(
  entries.map(({ clientId, ...entry }) => [clientId, entry]),
);

<Input
  id={`${entry.clientId}-${Field.companyName}`}
  name={Field.companyName}
  value={entry.companyName}
/>
<FormField
  error={
    serverState.entryErrors?.properties?.[entry.clientId]?.properties?.companyName?.errors?.[0]
  }
/>
```

## Rules of Thumb

- The schema is the source of truth and the contract between the server action
  and the component
- Keep transformations in schema.
- Keep UI-only fields out of payload schema.
- Keep error mapping by `clientId` key from `z.treeifyError`.
- Keep field names sourced from `entrySchema.keyof().enum`.
- Keep DOM IDs row-unique with `clientId` prefixes/suffixes.
- Keep one-off render values inline for locality.
- Keep list render order stable by created sequence.
