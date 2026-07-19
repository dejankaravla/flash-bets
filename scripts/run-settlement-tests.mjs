import { spawn } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const port = Number(process.env.FLASHBETS_TEST_MONGO_PORT || 27118);
const dbPath = path.join(os.tmpdir(), `flashbets-settlement-mongo-${process.pid}`);
const defaultMongod = process.platform === "win32"
  ? "C:\\Program Files\\MongoDB\\Server\\5.0\\bin\\mongod.exe"
  : "mongod";
const mongod = process.env.MONGOD_PATH || defaultMongod;
const testUri = `mongodb://127.0.0.1:${port}/flashbets_test`;

await mkdir(dbPath, { recursive: true });
const server = spawn(
  mongod,
  [
    "--dbpath", dbPath,
    "--port", String(port),
    "--bind_ip", "127.0.0.1",
    "--quiet",
  ],
  { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-8_000); });
server.stderr.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-8_000); });

function waitForPort(timeoutMs = 15_000) {
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
        if (Date.now() - started >= timeoutMs) reject(new Error(`MongoDB did not start\n${serverOutput}`));
        else setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

function runTests(files) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "--test", "--test-concurrency=1", ...files],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        windowsHide: true,
        env: {
          ...process.env,
          MONGODB_URI: testUri,
          SETTLEMENT_DELAY_SECONDS: "120",
          SETTLEMENT_TIMEOUT_SECONDS: "900",
          FLASHBETS_TXLINE_STALE_AFTER_SECONDS: "120",
          NODE_PATH: path.resolve("node_modules/next/dist/compiled"),
        },
      },
    );
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

let exitCode = 1;
try {
  await waitForPort();
  const files = (await readdir(path.resolve("tests")))
    .filter((name) => name.endsWith(".test.ts"))
    .sort()
    .map((name) => path.join("tests", name));
  exitCode = await runTests(files);
} finally {
  if (!server.killed) server.kill();
  await new Promise((resolve) => server.once("exit", resolve));
  await rm(dbPath, { recursive: true, force: true });
}

process.exitCode = exitCode;
