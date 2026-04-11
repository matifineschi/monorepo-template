import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie name set by better-auth
const SESSION_COOKIE_NAME = "better-auth.session_token";

const PROTECTED_ROUTES = ["/dashboard"];
const AUTH_ROUTES = ["/sign-in", "/sign-up"];

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
	const isAuthenticated = !!sessionCookie?.value;

	// Redirect unauthenticated users away from protected routes
	const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
	if (isProtected && !isAuthenticated) {
		const signInUrl = new URL("/sign-in", request.url);
		signInUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(signInUrl);
	}

	// Redirect authenticated users away from auth pages
	const isAuthRoute = AUTH_ROUTES.includes(pathname);
	if (isAuthRoute && isAuthenticated) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
