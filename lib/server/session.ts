import "server-only";

import { cookies } from "next/headers";

import type { AuthenticatedUserView } from "@/lib/domain/flash-bets";
import {
  DEFAULT_SESSION_TTL_SECONDS,
  SESSION_COOKIE_NAME,
  readAuthenticatedUser,
} from "@/lib/server/auth-service";
import { ApiError } from "@/lib/server/errors";

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

export async function currentUser(): Promise<AuthenticatedUserView | null> {
  return readAuthenticatedUser(await sessionToken());
}

export async function requireCurrentUser(): Promise<AuthenticatedUserView> {
  const user = await currentUser();
  if (!user) throw new ApiError("UNAUTHENTICATED", "Wallet sign-in required", 401);
  return user;
}

export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const maxAge = Math.max(
    1,
    Math.min(
      DEFAULT_SESSION_TTL_SECONDS,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1_000),
    ),
  );
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
    priority: "high",
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
