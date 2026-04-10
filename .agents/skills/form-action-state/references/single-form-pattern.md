# Single Form Pattern

Use this pattern for single-entity form submits where one Zod schema defines validation, parsed types, and field-level error shape.

## Schema and Action State

```ts
import z from "zod";
import type { $ZodFlattenedError } from "zod/v4/core";

const formSchema = z.object({
  assetMake: z.string().trim().min(2, "Enter a make"),
  assetModel: z.string().trim().min(2, "Enter a model"),
  assetYear: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a valid year after 1900")
    .transform((value) => Number(value))
    .refine((value) => value >= 1900, "Enter a valid year after 1900"),
  valueOfAsset: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Please enter the value of the vehicle")
    .transform((value) => Number(value))
    .refine((value) => value >= 1, "Please enter the value of the vehicle"),
});

type FormInput = z.input<typeof formSchema>;
const Field = formSchema.keyof().enum;
type FieldErrors = $ZodFlattenedError<
  z.output<typeof formSchema>
>["fieldErrors"];

type ActionState = {
  entryErrors?: FieldErrors;
  error?: string;
  success?: boolean;
};
```

## Parse Once in Action

```ts
const rawFormData = Object.fromEntries(formData.entries());
const { data, success, error } = formSchema.safeParse(rawFormData);

if (!success) {
  return {
    entryErrors: z.flattenError(error).fieldErrors,
    error: "Invalid submission",
  };
}

// Persist using `data` directly.
```

## Client Binding and Error Rendering

```ts
const [entry, setEntry] = useState<FormInput>(() => initialEntry);
const [serverState, formAction] = useActionState<ActionState, FormData>(action, {});

<Input name={Field.assetMake} value={entry.assetMake} />
<FormField error={serverState?.entryErrors?.assetMake} />
```

## Rules of Thumb

- The schema is the contract between the form and server action.
- Validation and coercion live in schema, not duplicated in handlers.
- Field errors come directly from `z.flattenError(error).fieldErrors`.
- Input `name` values should come from `formSchema.keyof().enum`.
- Keep one-off values inline to preserve locality.
- Use this for one-entity submits only; use list skill for multi-row forms.
