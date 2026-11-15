import { toNextJsHandler } from "better-auth/next-js";

import { authHandler } from "@repo/features/auth";

export const { GET, POST } = toNextJsHandler(authHandler);
