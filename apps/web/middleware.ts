import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie name set by better-auth
const SESSION_COOKIE_NAME = "better-auth.session_token";

const PROTECTED_ROUTES = ["/dashboard"];

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
	const isAuthenticated = !!sessionCookie?.value;

	// Cheap cookie-presence check to keep unauthenticated users out of protected routes.
	// Real session validation happens in the route's server component.
	const isProtected = PROTECTED_ROUTES.some((route) =>
		pathname.startsWith(route),
	);
	if (isProtected && !isAuthenticated) {
		const signInUrl = new URL("/sign-in", request.url);
		signInUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(signInUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard/:path*"],
};
