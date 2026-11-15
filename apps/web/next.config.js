/** @type {import('next').NextConfig} */
const nextConfig = {
	/**
	 * Emits .next/standalone with a self-contained server.js and only the
	 * node_modules actually reached. Without it a runtime image has to carry the
	 * whole monorepo's dependencies, and in a workspace that is most of them.
	 *
	 * Ties the repo to nothing: Vercel ignores it, every container host uses it.
	 */
	output: "standalone",
};

export default nextConfig;
