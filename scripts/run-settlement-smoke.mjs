import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const mongoPort = Number(process.env.FLASHBETS_SMOKE_MONGO_PORT || 27119);
const appPort = Number(process.env.FLASHBETS_SMOKE_APP_PORT || 3212);
const dbPath = path.join(os.tmpdir(), `flashbets-settlement-smoke-${process.pid}`);
const smokeDistDir = ".next-smoke";
const smokeDistPath = path.resolve(process.cwd(), smokeDistDir);
const mongod = process.env.MONGOD_PATH || (process.platform === "win32"
  ? "C:\\Program Files\\MongoDB\\Server\\5.0\\bin\\mongod.exe"
  : "mongod");
const mongoUri = `mongodb://127.0.0.1:${mongoPort}/flashbets_smoke`;
const origin = `http://localhost:${appPort}`;

function waitForPort(port, timeoutMs = 15_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started >= timeoutMs) reject(new Error(`Port ${port} did not open`));
        else setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

async function waitForApp(timeoutMs = 45_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${origin}/`);
      if (response.ok) return;
    } catch {
      // Development server is still compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next development server did not become ready");
}

function runFoundationSmoke(env) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/foundation-smoke.ts"],
      { cwd: process.cwd(), env, stdio: "inherit", windowsHide: true },
    );
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

function runMigration(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "scripts/migrate-json-to-mongodb.ts"],
      {
        cwd: process.cwd(),
        env: { ...env, NODE_PATH: path.resolve("node_modules/next/dist/compiled") },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`JSON migration exited with ${code ?? 1}`));
    });
  });
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill();
  });
}

await mkdir(dbPath, { recursive: true });
const mongo = spawn(
  mongod,
  ["--dbpath", dbPath, "--port", String(mongoPort), "--bind_ip", "127.0.0.1", "--quiet"],
  { windowsHide: true, stdio: "ignore" },
);
let next;
let exitCode = 1;
try {
  await waitForPort(mongoPort);
  const env = {
    ...process.env,
    FLASHBETS_MODE: "REPLAY",
    FLASHBETS_NEXT_DIST_DIR: smokeDistDir,
    MONGODB_URI: mongoUri,
    FLASHBETS_SMOKE_ORIGIN: origin,
    FLASHBETS_TXLINE_STALE_AFTER_SECONDS: "120",
  };
  await runMigration(env);
  next = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(appPort)],
    { cwd: process.cwd(), env, stdio: "inherit", windowsHide: true },
  );
  await waitForApp();
  for (const route of [
    "/",
    "/dashboard",
    "/match/20260001",
    "/my-predictions",
    "/my-bets",
    "/leaderboard",
    "/api/markets?fixtureId=20260001",
    "/api/predictions",
    "/api/replays",
  ]) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    console.log(JSON.stringify({ route, status: response.status }));
    if (response.status >= 500) throw new Error(`${route} returned ${response.status}`);
  }
  exitCode = await runFoundationSmoke(env);
} finally {
  await stopProcess(next);
  await stopProcess(mongo);
  await rm(dbPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  if (path.dirname(smokeDistPath) === process.cwd() && path.basename(smokeDistPath) === ".next-smoke") {
    await rm(smokeDistPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

process.exitCode = exitCode;
