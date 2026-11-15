import { EmailButton } from "../components/email-button";
import { EmailHeading } from "../components/email-heading";
import { EmailLayout } from "../components/email-layout";
import { EmailText } from "../components/email-text";
import { brand } from "../theme";

export type WelcomeEmailProps = {
	firstName: string;
	dashboardUrl: string;
};

function WelcomeEmail({ firstName, dashboardUrl }: WelcomeEmailProps) {
	return (
		<EmailLayout preview={`Welcome to ${brand.name}, ${firstName}`}>
			<EmailHeading>Welcome to {brand.name}</EmailHeading>
			<EmailText>
				Hi {firstName}, your account is ready. Your workspace is waiting for you
				on the dashboard.
			</EmailText>
			<EmailButton href={dashboardUrl} label="Go to your dashboard" />
			<EmailText type="supporting">
				If you didn&apos;t create this account, you can ignore this email.
			</EmailText>
		</EmailLayout>
	);
}

WelcomeEmail.PreviewProps = {
	firstName: "Ada",
	dashboardUrl: "http://localhost:3000/dashboard",
} satisfies WelcomeEmailProps;

/**
 * Default export, against the repo's named-export convention, because the React
 * Email preview server (`email:dev`) renders each template file's default.
 */
export default WelcomeEmail;
