/**
 * The Acme lightning mark. Sized by the surrounding Astryx component (NavIcon,
 * Button icon slot) via `currentColor` and a 1em box, so it inherits type scale
 * instead of carrying its own dimensions.
 */
export function BrandMark() {
	return (
		<svg
			viewBox="0 0 24 24"
			width="1em"
			height="1em"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<title>Acme</title>
			<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
		</svg>
	);
}
