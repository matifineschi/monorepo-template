# @repo/ui

Shared React component library: [shadcn/ui](https://ui.shadcn.com) components
(new-york style) on [Tailwind CSS v4](https://tailwindcss.com).

Consumed as TypeScript source — there is no build step.

## Usage

```tsx
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/src/lib/utils";
```

The consuming app imports the stylesheet once:

```css
@import "@repo/ui/globals.css";
```

That file is where `@import "tailwindcss"` lives, which is why `tailwindcss` is a
dependency of this package rather than of the apps.

## Adding a component

```sh
bunx shadcn@latest add <component>
```

`components.json` targets `src/globals.css` and aliases `@repo/ui/src/*`.

## Testing

Components are vendored shadcn and are not unit tested — a test there would
assert Radix's behavior rather than ours. `src/lib/utils.ts` (`cn`) is the one
piece that is genuinely this repo's, and it is covered.

If you write a component worth testing, `@happy-dom/global-registrator` in a
bunfig preload plus `@testing-library/react` works under `bun test`, but
`GlobalRegistrator.register()` must run before React is imported anywhere — the
preload order becomes load-bearing.

## Commands

| Command | What it does |
|---|---|
| `bun run lint` | Biome check (no ESLint, no Prettier in this repo) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | Unit tests in `src/**/__tests__/` |

Run `bun run format` from the repo root to apply fixes across the monorepo.
