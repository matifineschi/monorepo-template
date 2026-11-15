import { EmailButton } from "../components/email-button";
import { EmailHeading } from "../components/email-heading";
import { EmailLayout } from "../components/email-layout";
import { EmailText } from "../components/email-text";
import { brand } from "../theme";

export type PasswordResetEmailProps = {
	firstName: string;
	resetUrl: string;
	expiresInMinutes: number;
};

function PasswordResetEmail({
	firstName,
	resetUrl,
	expiresInMinutes,
}: PasswordResetEmailProps) {
	return (
		<EmailLayout preview={`Reset your ${brand.name} password`}>
			<EmailHeading>Reset your password</EmailHeading>
			<EmailText>
				Hi {firstName}, we received a request to reset the password for your{" "}
				{brand.name} account.
			</EmailText>
			<EmailButton href={resetUrl} label="Reset password" />
			<EmailText type="supporting">
				This link expires in {expiresInMinutes} minutes and can be used once. If
				you didn&apos;t ask to reset your password, ignore this email and your
				password stays the same.
			</EmailText>
		</EmailLayout>
	);
}

PasswordResetEmail.PreviewProps = {
	firstName: "Ada",
	resetUrl: "http://localhost:3000/api/auth/reset-password/preview-token",
	expiresInMinutes: 60,
} satisfies PasswordResetEmailProps;

/**
 * Default export, against the repo's named-export convention, because the React
 * Email preview server (`email:dev`) renders each template file's default.
 */
export default PasswordResetEmail;
