import { neutralTheme } from "@astryxdesign/theme-neutral/built";

/**
 * The one place the app's Astryx theme is chosen.
 *
 * `Providers` mounts it for the web UI, and `@repo/features/email` resolves its
 * tokens into concrete values for email templates (which cannot use CSS custom
 * properties). Swap the theme here and both follow; `globals.css` must import
 * the same theme's `theme.css` and `fonts.css`.
 */
export const theme = neutralTheme;
