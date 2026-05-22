import { releaseExpiredReservations } from "@/lib/expiry";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await releaseExpiredReservations();
  return Response.json({ ok: true });
}
