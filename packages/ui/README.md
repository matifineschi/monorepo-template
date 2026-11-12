# @repo/ui

The app's **theme layer** for [Astryx](https://astryx.atmeta.com), Meta's open
source design system.

This is deliberately _not_ a component library. Apps import components straight
from `@astryxdesign/core`:

```tsx
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Stack";
```

What lives here is only the two things an app cannot import per-component.

## `src/globals.css`

The design system's three stylesheets, in cascade-layer order:

| Import                                  | Layer                            |
| --------------------------------------- | -------------------------------- |
| `@astryxdesign/core/reset.css`          | `reset`                          |
| `@astryxdesign/core/astryx.css`         | `astryx-base` (component styles) |
| `@astryxdesign/theme-neutral/theme.css` | `astryx-theme` (token overrides) |

Plus the theme's own `fonts.css`.

**The order is load-bearing, and so is where this file is imported.** It must be
the _first_ stylesheet the page loads, because it is what names the layers — a
stylesheet that loads before it silently inverts the cascade, with a clean build
and a clean console. That is why `apps/web/app/layout.tsx` imports
`./globals.css` on its first line, above every other import.

## `src/providers.tsx`

Mounts `Theme` and `LinkProvider` at the app root.

- `Theme` carries the token set and defaults to `mode="system"` — that is where
  dark mode comes from. There is no `next-themes` and no `.dark` class.
- `LinkProvider component={Link}` is what lets every link-bearing Astryx
  component take a plain `href` and render it through `next/link`, so app code
  never needs an `asChild` escape hatch.

`next` is a **peer** dependency for this reason: the app's version governs.

## Changing the look

A theme is a set of design-token overrides, not a fork. Swap the theme package
(`bun run astryx theme list`) or author one with `defineTheme` — see
`bun run astryx docs author-a-theme`. Do not add `:root` overrides.

## Adding a component

You don't. Import it from `@astryxdesign/core`, after reading its docs:

```sh
bun run astryx search <query>
bun run astryx component <Name>
```

If a component genuinely has to be owned locally, `bun run astryx swizzle <Name>`
copies its source into `src/components/` — do that deliberately and say why in a
comment. It is the one circumstance under which that directory exists.

## Tests

There are none, and the package declares no `test` script. A test here would
assert Astryx's behavior rather than ours, and `bun test` exits non-zero when no
files match, which would fail `turbo run test`.
