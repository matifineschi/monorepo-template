import { usersTable } from "./users";
import {
	accounts as userAuthAccounts,
	accountsRelations as userAuthAccountsRelations,
	sessions as userAuthSessions,
	sessionsRelations as userAuthSessionsRelations,
	userAuthSchema,
	users as userAuthUsers,
	usersRelations as userAuthUsersRelations,
	verifications as userAuthVerifications,
} from "./user-auth";

export const publicSchema = {
	users: usersTable,
};

export const userAuth = {
	userAuthSchema,
	userAuthUsers,
	userAuthSessions,
	userAuthAccounts,
	userAuthVerifications,
	userAuthUsersRelations,
	userAuthSessionsRelations,
	userAuthAccountsRelations,
};

export const schema = {
	...publicSchema,
	...userAuth,
} as const;
