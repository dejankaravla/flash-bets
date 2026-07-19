import { currentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await currentUser();
  return Response.json(
    user ? { authenticated: true, user } : { authenticated: false, user: null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
