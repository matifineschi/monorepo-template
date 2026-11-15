import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

/**
 * Where the emailed link lands. better-auth's `/api/auth/reset-password/:token`
 * checks the token and redirects here with `?token=` when it is valid, or with
 * `?error=INVALID_TOKEN` when it has expired or been used.
 */
export default async function ResetPasswordPage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string; error?: string }>;
}) {
	const { token, error } = await searchParams;

	return <ResetPasswordForm token={error || !token ? null : token} />;
}
