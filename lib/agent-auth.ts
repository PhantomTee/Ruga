import type { NextRequest } from "next/server";

export function assertAgentAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    throw new Error("Unauthorized agent route call");
  }
}
