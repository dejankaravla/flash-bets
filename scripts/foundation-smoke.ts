import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

const origin = process.env.FLASHBETS_SMOKE_ORIGIN || "http://localhost:3210";
const wallet = Keypair.generate();
const walletAddress = wallet.publicKey.toBase58();
const mode = process.env.FLASHBETS_MODE?.toUpperCase() === "REPLAY" ? "REPLAY" : "LIVE";

async function json(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
const challengeResponse = await fetch(`${origin}/api/auth/challenge`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({ wallet: walletAddress }),
});
const challenge = await json(challengeResponse);
const signature = bs58.encode(
  nacl.sign.detached(
    new TextEncoder().encode(String(challenge.message)),
    wallet.secretKey,
  ),
);

const verifyResponse = await fetch(`${origin}/api/auth/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({
    challengeId: challenge.challengeId,
    wallet: walletAddress,
    signature,
  }),
});
const verified = await json(verifyResponse);
const cookie = verifyResponse.headers.get("set-cookie")?.split(";", 1)[0];
if (!cookie) throw new Error("Authentication did not set a session cookie");

const account = await json(
  await fetch(`${origin}/api/flashpoints`, { headers: { Cookie: cookie } }),
);
const flashPoints = account.flashPoints as { available?: number };
if (flashPoints.available !== 1_000) {
  throw new Error(`Expected 1000 FlashPoints, received ${flashPoints.available}`);
}

let replayControlVerified = false;
let replayHistoryVerified = false;
if (mode === "REPLAY") {
  const selected = await json(
    await fetch(`${origin}/api/replays/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin },
      body: JSON.stringify({ replayId: "world-cup-brazil-argentina" }),
    }),
  );
  const selectedState = selected.state as { fixtureId?: number; status?: string };
  if (!selectedState.fixtureId || selectedState.status !== "PAUSED") {
    throw new Error("Replay selection did not create a paused run");
  }
  const marketView = await json(
    await fetch(`${origin}/api/markets?fixtureId=${selectedState.fixtureId}`),
  );
  if (!Array.isArray(marketView.markets) || marketView.markets.length === 0) {
    throw new Error("Replay selection did not create canonical markets");
  }
  const speed = await json(
    await fetch(`${origin}/api/replays/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin },
      body: JSON.stringify({ action: "SPEED", speed: 10 }),
    }),
  );
  const speedState = speed.state as { speed?: number };
  if (speedState.speed !== 10) throw new Error("Replay speed control failed");
  await json(
    await fetch(`${origin}/api/replays/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin },
      body: JSON.stringify({ action: "PLAY" }),
    }),
  );
  const finishDeadline = Date.now() + 90_000;
  let finished = false;
  while (Date.now() < finishDeadline) {
    const replayCatalog = await json(await fetch(`${origin}/api/replays`));
    const active = replayCatalog.active as { status?: string } | null;
    if (active?.status === "FINISHED") {
      finished = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!finished) throw new Error("Replay did not finish within the smoke-test deadline");
  const dashboardResponse = await fetch(`${origin}/dashboard`);
  const dashboardHtml = await dashboardResponse.text();
  if (!dashboardResponse.ok || !dashboardHtml.includes("Completed run")) {
    throw new Error("Finished dashboard did not render the completed replay run");
  }
  replayControlVerified = true;
  replayHistoryVerified = true;
}

const settlement = await json(
  await fetch(`${origin}/api/settlement/run`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: origin },
  }),
);
if (typeof settlement.dueMarkets !== "number") {
  throw new Error("Settlement runner returned an invalid response");
}

await json(
  await fetch(`${origin}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: origin },
  }),
);
const afterLogout = await fetch(`${origin}/api/flashpoints`, {
  headers: { Cookie: cookie },
});
if (afterLogout.status !== 401) throw new Error("Logout did not revoke the session");

console.log(
  JSON.stringify({
    authenticated: verified.authenticated,
    initialFlashPoints: flashPoints.available,
    settlementRunnerAuthenticated: true,
    dueMarkets: settlement.dueMarkets,
    replayControlVerified,
    replayHistoryVerified,
    logoutRevokedSession: true,
  }),
);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
